import { useState, useEffect, useCallback, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { dbService } from '../api/Database';
import { computeFileHash } from '../utils/HashUtils';
import { APP_CONSTANTS } from '../constants/AppConstants';

export interface PendingAsset extends MediaLibrary.Asset {
  fileSize: number;
}

export interface FetchOptions {
  mediaType?: MediaLibrary.MediaTypeValue[];
  sizeFilter?: 'all' | 'small' | 'large';
  limit?: number;
  deepScan?: boolean;
}

export function usePendingUploads() {
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [scanProgress, setScanProgress] = useState<number | undefined>(undefined);
  const [scanStatus, setScanStatus] = useState<string>('');
  const lastAssetId = useRef<string | undefined>(undefined);

  const fetchPending = useCallback(async (options: FetchOptions = {}, reset = false) => {
    if (loading) return;
    setLoading(true);
    setScanProgress(options.deepScan ? 0 : undefined);
    setScanStatus(options.deepScan ? 'Starting deep scan...' : '');

    try {
      const { 
        mediaType = [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sizeFilter = 'all',
        limit = APP_CONSTANTS.UI.LISTS.PAGE_SIZE 
      } = options;

      if (reset) {
        lastAssetId.current = undefined;
        setPendingAssets([]);
      }

      // 1. If Deep Scan, we scan EXACTLY EVERYTHING in the library
      if (options.deepScan) {
        console.log('[DeepScan] Starting COMPREHENSIVE library scan...');
        const initialResult = await MediaLibrary.getAssetsAsync({ mediaType, first: 1 });
        const totalToScan = initialResult.totalCount;
        console.log(`[DeepScan] Total assets found on device: ${totalToScan}`);
        
        let hasNextPass = totalToScan > 0;
        let currentAfterPass: string | undefined = undefined;
        let totalProcessed = 0;

        while (hasNextPass && totalProcessed < totalToScan) {
          console.log(`[DeepScan] Fetching next batch after: ${currentAfterPass || 'START'}`);
          const result: MediaLibrary.PagedInfo<MediaLibrary.Asset> = await MediaLibrary.getAssetsAsync({
            first: APP_CONSTANTS.SYNC.SCAN_BATCH_SIZE,
            after: currentAfterPass,
            mediaType,
            // Removing sortBy for deep scan as it can break pagination with 'after'
          });

          if (result.assets.length === 0) {
            console.log('[DeepScan] No more assets returned in this batch.');
            break;
          }

          console.log(`[DeepScan] Received batch of ${result.assets.length} items. hasNextPage=${result.hasNextPage}, endCursor=${result.endCursor}`);

          for (const asset of result.assets) {
            totalProcessed++;
            // ... (throttled updates)
            if (totalToScan > 0 && (totalProcessed % 10 === 0 || totalProcessed === totalToScan)) {
              setScanProgress((totalProcessed / totalToScan) * 100);
              setScanStatus(`Verifying ${totalProcessed} / ${totalToScan}`);
            }

            if (totalProcessed % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            const isRecorded = await dbService.getUploadByAssetId(asset.id);
            if (!isRecorded) {
              try {
                if (totalProcessed % 20 === 0) {
                  console.log(`[FullDeepScan] Processed ${totalProcessed}...`);
                }
                const hash = await computeFileHash(asset.uri);
                const exists = await dbService.isFileUploaded(hash);
                if (exists) {
                  console.log(`[FullDeepScan] MATCH FOUND for ${asset.filename} (${hash.substring(0, 8)}...)`);
                  await dbService.recordUpload(asset.id, hash, 0, 'me (remapped)');
                }
              } catch (e) {
                console.error(`[FullDeepScan] Error processing asset ${asset.id}:`, e);
              }
            }
          }
          currentAfterPass = result.endCursor || result.assets[result.assets.length - 1].id;
          hasNextPass = result.hasNextPage;
        }
        console.log(`[DeepScan] Completed. Scanned ${totalProcessed} items.`);
        // Reset everything to "refresh" from the top after a deep scan
        lastAssetId.current = undefined;
        setPendingAssets([]);
      }

      // 2. Standard Fetch (or Refill after scan)
      const newPending: PendingAsset[] = [];
      let currentAfter = lastAssetId.current;
      console.log(`[Pending] Fetching starting from asset: ${currentAfter || 'START'}, limit: ${limit}`);
      while (newPending.length < limit) {
        console.log(`[Pending] Fetching batch... after=${currentAfter || 'START'}, batchSize=${APP_CONSTANTS.SYNC.SCAN_BATCH_SIZE}`);
        const result = await MediaLibrary.getAssetsAsync({
          first: APP_CONSTANTS.SYNC.SCAN_BATCH_SIZE,
          after: currentAfter,
          mediaType,
        });

        console.log(`[Pending] Result: batch=${result.assets.length}, totalInLibrary=${result.totalCount}, hasNextPage=${result.hasNextPage}`);

        if (result.assets.length === 0) {
          console.log('[Pending] MediaLibrary returned 0 assets. End of stream.');
          setHasNextPage(false);
          break;
        }

        // Batch check database
        const assetIds = result.assets.map(a => a.id);
        const uploadedSet = await dbService.batchCheckUploads(assetIds);
        const pendingsInBatch = result.assets.filter(a => !uploadedSet.has(a.id));
        console.log(`[Pending] Batch Info: ${pendingsInBatch.length} / ${result.assets.length} are pending upload.`);

        for (const asset of result.assets) {
          const isPending = !uploadedSet.has(asset.id);
          currentAfter = asset.id;

          if (isPending) {
            const info = await FileSystem.getInfoAsync(asset.uri);
            if (info.exists) {
              const size = info.size;
              let matchesSize = true;
              if (sizeFilter === 'small') matchesSize = size < 500 * 1024 * 1024;
              else if (sizeFilter === 'large') matchesSize = size >= 500 * 1024 * 1024;

              if (matchesSize) {
                newPending.push({ ...asset, fileSize: size });
                if (newPending.length >= limit) break;
              }
            }
          }
        }

        if (newPending.length >= limit) {
            console.log(`[Pending] Found enough items (${newPending.length}). Exiting fetch loop.`);
            break;
        }

        if (!result.hasNextPage) {
            console.log('[Pending] MediaLibrary says no more assets. Exiting fetch loop.');
            setHasNextPage(false);
            break;
        }
        
        console.log(`[Pending] Batch exhausted with only ${newPending.length} items. Fetching next batch...`);
      }

      lastAssetId.current = currentAfter;
      console.log(`[Pending] Batch check complete. Found ${newPending.length} pending items in this pass.`);
      setPendingAssets(prev => {
        const next = reset || options.deepScan ? newPending : [...prev, ...newPending];
        console.log(`[Pending] State updated. New total size: ${next.length}`);
        return next;
      });
    } catch (e) {
      console.error('[usePendingUploads] Error:', e);
    } finally {
      setLoading(false);
      setScanProgress(undefined);
    }
  }, [loading]);

  return { pendingAssets, loading, hasNextPage, fetchPending, scanProgress, scanStatus };
}
