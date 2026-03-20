import { useState, useCallback, useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { useMedia } from './useMedia';
import { useUpload } from './useUpload';
import { dbService } from '../api/Database';
import { CONFIG } from '../constants/Config';
import { usePendingUploads } from './usePendingUploads';
import { APP_CONSTANTS } from '../constants/AppConstants';
import { normalizeTimestamp } from '../utils/formatters';

export function useBackup() {
  const { refresh: refreshMedia, totalCount } = useMedia();
  const { uploadAsset, uploadingId, progress } = useUpload();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<number | undefined>(undefined);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [backedUpCount, setBackedUpCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const { fetchPending, scanProgress, scanStatus, loading: isScanning } = usePendingUploads();

  const fetchSyncStats = useCallback(async () => {
    const total = await dbService.getSyncedCount();
    const success = await dbService.getSuccessfulSyncCount();
    setSyncedCount(total);
    setSuccessCount(success);
  }, []);

  const wipeDatabase = useCallback(async () => {
    await dbService.clearDatabase();
    await fetchSyncStats();
    await refreshMedia();
  }, [fetchSyncStats, refreshMedia]);

  // Initial fetch
  useEffect(() => {
    fetchSyncStats();
  }, [fetchSyncStats]);

  const startBackup = useCallback(async () => {
    if (isBackingUp) return;
    
    setIsBackingUp(true);
    setBackedUpCount(0);
    
    try {
      let after: string | undefined;
      let hasNextPage = true;

      while (hasNextPage) {
        const page = await MediaLibrary.getAssetsAsync({
          first: APP_CONSTANTS.SYNC.SCAN_BATCH_SIZE,
          after,
          sortBy: [[MediaLibrary.SortBy.creationTime, false] as any],
          mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        });

        for (const asset of page.assets) {
          try {
            const normalizedCreationTime = normalizeTimestamp(asset.creationTime);
            const result = await uploadAsset({
              ...asset,
              creationTime: normalizedCreationTime,
              normalizedCreationTime,
            });
            if (result.success && !result.skipped) {
              setBackedUpCount(prev => prev + 1);
            }
          } catch (e) {
            console.error('Individual asset backup failed:', asset.id, e);
          }
        }

        after = page.endCursor || undefined;
        hasNextPage = page.hasNextPage;
      }
    } finally {
      setIsBackingUp(false);
      fetchSyncStats();
      refreshMedia();
    }
  }, [isBackingUp, uploadAsset, refreshMedia, fetchSyncStats]);

  const deepScanDevice = useCallback(async () => {
    try {
      await fetchPending({ deepScan: true }, true);
      await fetchSyncStats();
      await refreshMedia();
    } catch (e) {
      console.error('Deep scan failed:', e);
    }
  }, [fetchPending, fetchSyncStats, refreshMedia]);

  const restoreFromCloud = useCallback(async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    setRestoreProgress(0);
    setRestoreStatus('Connecting to Telegram...');

    try {
      const url = `${CONFIG.BACKEND_URL}${APP_CONSTANTS.NETWORK.API.RESTORE}`;
      const response = await fetch(url, {
        headers: { [APP_CONSTANTS.NETWORK.API_KEY_HEADER]: CONFIG.API_KEY }
      });
      const data = await response.json();
      
      if (data.hashes && data.hashes.length > 0) {
        const total = data.hashes.length;
        for (let i = 0; i < total; i++) {
          const hash = data.hashes[i];
          console.log('Restoring hash:', hash);
          await dbService.recordUpload(null, hash, 1, 'Restored from Telegram');
          console.log('Stored hash:', hash);
          setRestoreProgress(((i + 1) / total) * 100);
          setRestoreStatus(`Restored ${i + 1} / ${total}`);
        }
      } else {
        setRestoreStatus('No cloud metadata found.');
      }
    } catch (e: any) {
      console.error('Restore failed:', e);
      setRestoreStatus(`Error: ${e.message}`);
    } finally {
      setTimeout(() => {
        setIsRestoring(false);
        setRestoreProgress(undefined);
        fetchSyncStats();
      }, 1500); 
    }
  }, [isRestoring, fetchSyncStats]);

  return { 
    startBackup, 
    deepScanDevice,
    restoreFromCloud,
    wipeDatabase,
    isBackingUp, 
    isRestoring,
    isScanning,
    restoreProgress,
    restoreStatus,
    scanProgress,
    scanStatus,
    uploadingId, 
    progress,
    backedUpCount,
    syncedCount,
    successCount,
    totalMediaCount: totalCount
  };
}
