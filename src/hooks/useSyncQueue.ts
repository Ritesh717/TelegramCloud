import { useState, useCallback, useRef, useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';

import { telegramService } from '../api/TelegramClient';
import { dbService, QueueStatus, UploadQueueItem } from '../api/Database';
import { computeFileHash } from '../utils/HashUtils';
import { PendingAsset } from './usePendingUploads';
import { APP_CONSTANTS } from '../constants/AppConstants';

const MAX_CONCURRENCY = Math.max(1, APP_CONSTANTS.SYNC.CONCURRENCY);
const MAX_BATCH_FILES = APP_CONSTANTS.SYNC.MAX_BATCH_FILES;
const LARGE_FILE_THRESHOLD = APP_CONSTANTS.SYNC.LARGE_FILE_THRESHOLD;
const RETRYABLE_STATUSES: QueueStatus[] = ['queued', 'retrying'];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useSyncQueue() {
  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([]);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [activeCount, setActiveCount] = useState(0);
  const [queueLength, setQueueLength] = useState(0);

  const isMountedRef = useRef(true);
  const processingRef = useRef(false);
  const cancelledIdsRef = useRef(new Set<string>());

  const refreshQueueState = useCallback(async () => {
    const snapshot = await dbService.getQueueSnapshot();
    if (!isMountedRef.current) return;

    setQueueItems(snapshot.items);
    setActiveCount(snapshot.counts.uploading);
    setQueueLength(
      snapshot.counts.queued + snapshot.counts.retrying + snapshot.counts.uploading
    );
    setUploadingIds(
      new Set(
        snapshot.items
          .filter((item) => item.status === 'uploading' || item.status === 'retrying')
          .map((item) => item.assetId)
      )
    );
  }, []);

  const markRetry = useCallback(async (item: UploadQueueItem, error: unknown) => {
    const attempts = item.attempts + 1;
    const maxAttempts = item.maxAttempts || APP_CONSTANTS.SYNC.RETRY_MAX_ATTEMPTS;
    const errorMessage =
      error instanceof Error ? error.message : 'Upload failed due to an unknown error';

    if (attempts >= maxAttempts) {
      await dbService.updateQueueItem(item.assetId, {
        attempts,
        status: 'failed',
        errorMessage,
        progress: 0,
        nextRetryAt: 0,
      });
      return;
    }

    const delay = APP_CONSTANTS.SYNC.RETRY_DELAY * 2 ** (attempts - 1);
    await dbService.updateQueueItem(item.assetId, {
      attempts,
      status: 'retrying',
      errorMessage,
      progress: 0,
      nextRetryAt: Date.now() + delay,
    });
  }, []);

  const processItem = useCallback(async (item: UploadQueueItem) => {
    if (cancelledIdsRef.current.has(item.assetId)) {
      await dbService.markQueueCancelled(item.assetId);
      return;
    }

    await dbService.updateQueueItem(item.assetId, {
      status: 'uploading',
      progress: 0.15,
      errorMessage: null,
    });
    await refreshQueueState();

    try {
      const hash = item.hash || await computeFileHash(item.uri);
      await dbService.updateQueueItem(item.assetId, { hash, progress: 0.3 });

      const isUploaded = await dbService.isFileUploaded(hash);
      if (isUploaded) {
        await dbService.recordUpload(item.assetId, hash, 0, 'me (duplicate)');
        await dbService.updateQueueItem(item.assetId, {
          status: 'duplicate',
          progress: 1,
          errorMessage: null,
        });
        return;
      }

      let metadata: Record<string, unknown> = {
        mediaType: item.mediaType,
        creationTime: item.creationTime,
        hash,
      };

      try {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(item.assetId);
        if (assetInfo.location) {
          metadata = { ...metadata, location: assetInfo.location };
        }
      } catch {
        // Non-fatal; upload should still proceed.
      }

      await dbService.updateQueueItem(item.assetId, { progress: 0.55 });
      const result = await telegramService.uploadFile(
        item.uri,
        item.filename,
        item.fileSize,
        metadata
      );

      if (cancelledIdsRef.current.has(item.assetId)) {
        await dbService.markQueueCancelled(item.assetId);
        return;
      }

      await dbService.recordUpload(item.assetId, hash, (result as any).id || 0, 'me');
      await dbService.updateQueueItem(item.assetId, {
        status: 'completed',
        progress: 1,
        errorMessage: null,
      });
    } catch (error) {
      await markRetry(item, error);
    } finally {
      await refreshQueueState();
    }
  }, [markRetry, refreshQueueState]);

  const processBatch = useCallback(async (items: UploadQueueItem[]) => {
    const activeItems = items.filter((item) => !cancelledIdsRef.current.has(item.assetId));
    if (activeItems.length === 0) return;

    const duplicateItems: UploadQueueItem[] = [];
    const uploadCandidates: Array<{
      item: UploadQueueItem;
      hash: string;
      metadata: Record<string, unknown>;
    }> = [];

    try {
      for (const item of activeItems) {
        await dbService.updateQueueItem(item.assetId, {
          status: 'uploading',
          progress: 0.15,
          errorMessage: null,
        });
      }
      await refreshQueueState();

      for (const item of activeItems) {
        const hash = item.hash || await computeFileHash(item.uri);
        await dbService.updateQueueItem(item.assetId, { hash, progress: 0.3 });

        const isUploaded = await dbService.isFileUploaded(hash);
        if (isUploaded) {
          duplicateItems.push(item);
          continue;
        }

        let metadata: Record<string, unknown> = {
          mediaType: item.mediaType,
          creationTime: item.creationTime,
          hash,
        };

        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(item.assetId);
          if (assetInfo.location) {
            metadata = { ...metadata, location: assetInfo.location };
          }
        } catch {
          // Non-fatal; upload should still proceed.
        }

        uploadCandidates.push({ item, hash, metadata });
      }

      for (const duplicateItem of duplicateItems) {
        if (cancelledIdsRef.current.has(duplicateItem.assetId)) {
          await dbService.markQueueCancelled(duplicateItem.assetId);
          continue;
        }

        const duplicateHash =
          uploadCandidates.find((candidate) => candidate.item.assetId === duplicateItem.assetId)?.hash ||
          duplicateItem.hash ||
          await computeFileHash(duplicateItem.uri);

        await dbService.recordUpload(duplicateItem.assetId, duplicateHash, 0, 'me (duplicate)');
        await dbService.updateQueueItem(duplicateItem.assetId, {
          status: 'duplicate',
          progress: 1,
          errorMessage: null,
        });
      }

      if (uploadCandidates.length === 0) {
        return;
      }

      for (const candidate of uploadCandidates) {
        await dbService.updateQueueItem(candidate.item.assetId, { progress: 0.55 });
      }
      await refreshQueueState();

      const results = await telegramService.uploadBatch(
        uploadCandidates.map((candidate) => ({
          uri: candidate.item.uri,
          filename: candidate.item.filename,
          hash: candidate.hash,
          fileSize: candidate.item.fileSize,
          metadata: candidate.metadata,
        }))
      );

      await Promise.all(
        uploadCandidates.map(async (candidate, index) => {
          if (cancelledIdsRef.current.has(candidate.item.assetId)) {
            await dbService.markQueueCancelled(candidate.item.assetId);
            return;
          }

          const result = results[index];
          if (result?.error) {
            await markRetry(candidate.item, new Error(result.error));
            return;
          }

          await dbService.recordUpload(
            candidate.item.assetId,
            candidate.hash,
            (result as any)?.id || 0,
            'me'
          );
          await dbService.updateQueueItem(candidate.item.assetId, {
            status: 'completed',
            progress: 1,
            errorMessage: null,
          });
        })
      );
    } catch (error) {
      await Promise.all(activeItems.map((item) => markRetry(item, error)));
    } finally {
      await refreshQueueState();
    }
  }, [markRetry, refreshQueueState]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      while (isMountedRef.current) {
        const current = await dbService.getQueueItems(RETRYABLE_STATUSES);
        const snapshot = await dbService.getQueueSnapshot();
        const ready = current.filter((item) => item.nextRetryAt <= Date.now());
        const availableSlots = Math.max(0, MAX_CONCURRENCY - snapshot.counts.uploading);

        if (ready.length === 0 || availableSlots === 0) {
          break;
        }

        const largeReady = ready.filter((item) => item.fileSize >= LARGE_FILE_THRESHOLD);
        if (largeReady.length > 0) {
          await processItem(largeReady[0]);
          continue;
        }

        const regularReady = ready.filter((item) => item.fileSize < LARGE_FILE_THRESHOLD);
        const batch = regularReady.slice(0, MAX_BATCH_FILES);
        if (batch.length === 0) {
          break;
        }

        await processBatch(batch);
      }
    } finally {
      processingRef.current = false;
      await refreshQueueState();
    }
  }, [processBatch, processItem, refreshQueueState]);

  useEffect(() => {
    isMountedRef.current = true;
    refreshQueueState();
    processQueue();

    const interval = setInterval(() => {
      refreshQueueState();
      processQueue();
    }, 1500);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [processQueue, refreshQueueState]);

  const addToQueue = useCallback(async (assets: PendingAsset[]) => {
    await dbService.enqueueUploads(
      assets.map((asset) => ({
        assetId: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        fileSize: asset.fileSize,
        mediaType: String(asset.mediaType),
        creationTime: asset.creationTime,
      }))
    );

    await refreshQueueState();
    await processQueue();
  }, [processQueue, refreshQueueState]);

  const cancelUpload = useCallback(async (assetId: string) => {
    cancelledIdsRef.current.add(assetId);
    await dbService.markQueueCancelled(assetId);
    await refreshQueueState();
  }, [refreshQueueState]);

  const retryUpload = useCallback(async (assetId: string) => {
    cancelledIdsRef.current.delete(assetId);
    await dbService.retryQueueItem(assetId);
    await refreshQueueState();
    await wait(50);
    await processQueue();
  }, [processQueue, refreshQueueState]);

  return {
    addToQueue,
    cancelUpload,
    retryUpload,
    queueItems,
    uploadingIds,
    activeCount,
    queueLength,
  };
}
