import { useState, useCallback, useRef } from 'react';
import { telegramService } from '../api/TelegramClient';
import { dbService } from '../api/Database';
import { computeFileHash } from '../utils/HashUtils';
import { PendingAsset } from './usePendingUploads';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const MAX_CONCURRENCY = 10;
const BATCH_SIZE = 10;
const SMALL_FILE_LIMIT = 10 * 1024 * 1024; // 10MB

export function useSyncQueue() {
  const [activeCount, setActiveCount] = useState(0);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const queueRef = useRef<PendingAsset[]>([]);
  const isProcessingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (queueRef.current.length > 0 && activeCount < MAX_CONCURRENCY) {
      const nextAsset = queueRef.current[0];
      if (!nextAsset) break;

      // Check if we can batch this small file
      if (nextAsset.fileSize < SMALL_FILE_LIMIT) {
        const batch: PendingAsset[] = [];
        const remainingQueue: PendingAsset[] = [];
        
        for (const item of queueRef.current) {
          if (batch.length < BATCH_SIZE && item.fileSize < SMALL_FILE_LIMIT) {
            batch.push(item);
          } else {
            remainingQueue.push(item);
          }
        }

        queueRef.current = remainingQueue;
        startBatchUpload(batch);
      } else {
        // Large file - single upload
        const largeAsset = queueRef.current.shift()!;
        startSingleUpload(largeAsset);
      }
      
      // We need to update active count locally to avoid stale state in the while loop
      // but useState is async. So we'll use a local counter for the loop if needed, 
      // or just let the recursive nature of processQueue handle it.
      // For now, let's just break and trust the callback in start*Upload.
      break; 
    }

    isProcessingRef.current = false;
  }, [activeCount]);

  const startSingleUpload = async (asset: PendingAsset) => {
    setActiveCount(prev => prev + 1);
    setUploadingIds(prev => new Set(prev).add(asset.id));

    try {
      const hash = await computeFileHash(asset.uri);
      const isUploaded = await dbService.isFileUploaded(hash);
      
      if (!isUploaded) {
        let metadata: any = {
            mediaType: asset.mediaType,
            creationTime: asset.creationTime,
            hash: hash,
        };
        try {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
            if (assetInfo.location) metadata.location = assetInfo.location;
        } catch (e) {}

        const result = await telegramService.uploadFile(asset.uri, asset.filename, asset.fileSize, metadata);
        await dbService.recordUpload(asset.id, hash, (result as any).id, 'me');
      } else {
        console.log(`[Sync] Skip: ${asset.filename} already synced`);
        await dbService.recordUpload(asset.id, hash, 0, 'me (remapped)');
      }
    } catch (error) {
      console.error(`[SyncQueue] Failed to upload ${asset.filename}:`, error);
    } finally {
      setActiveCount(prev => prev - 1);
      setUploadingIds(prev => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
      processQueue();
    }
  };

  const startBatchUpload = async (batch: PendingAsset[]) => {
    setActiveCount(prev => prev + 1);
    setUploadingIds(prev => {
      const next = new Set(prev);
      batch.forEach(a => next.add(a.id));
      return next;
    });

    try {
      const toUpload: PendingAsset[] = [];
      const hashes: string[] = [];
      
      for (const asset of batch) {
        const hash = await computeFileHash(asset.uri);
        const isUploaded = await dbService.isFileUploaded(hash);
        if (!isUploaded) {
          toUpload.push(asset);
          hashes.push(hash);
        } else {
          console.log(`[Sync] Skip: ${asset.filename} already synced`);
          await dbService.recordUpload(asset.id, hash, 0, 'me (remapped)');
        }
      }

      if (toUpload.length > 0) {
        const result = await telegramService.uploadBatch(toUpload.map((a, idx) => ({
            uri: a.uri,
            filename: a.filename,
            hash: hashes[idx]
        })));
        
        // Telegram returns multiple message objects for media groups usually, 
        // or a group object. Our backend returns the result of SendMultiMedia.
        // For simplicity, we'll record them.
        for (let i = 0; i < toUpload.length; i++) {
            await dbService.recordUpload(toUpload[i].id, hashes[i], (result as any)[i]?.id || 0, 'me');
        }
      }
    } catch (error) {
      console.error(`[SyncQueue] Batch upload failed:`, error);
    } finally {
      setActiveCount(prev => prev - 1);
      setUploadingIds(prev => {
        const next = new Set(prev);
        batch.forEach(a => next.delete(a.id));
        return next;
      });
      processQueue();
    }
  };

  const addToQueue = useCallback((assets: PendingAsset[]) => {
    queueRef.current = [...queueRef.current, ...assets];
    processQueue();
  }, [processQueue]);

  return { addToQueue, uploadingIds, activeCount, queueLength: queueRef.current.length };
}
