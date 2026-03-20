import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import { dbService } from '../api/Database';
import { CONFIG } from '../constants/Config';
import {
  autoBackupModule,
  AutoBackupStatus,
  NativeAutoBackupAsset,
} from '../native/AutoBackupModule';

const EMPTY_STATUS: AutoBackupStatus = {
  enabled: false,
  startedAt: 0,
  lastScanAt: 0,
  lastUploadedAt: 0,
  uploadedPhotoCount: 0,
  pendingVideoApprovals: [],
  uploadActive: false,
  activeUploadCount: 0,
};

export function useAutoBackup(onSyncedUploads?: () => void) {
  const [status, setStatus] = useState<AutoBackupStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);

  const reconcileCompletedUploads = useCallback(async () => {
    console.log('[useAutoBackup] reconcileCompletedUploads start');
    const completed = await autoBackupModule.consumeCompletedUploads();
    if (completed.length === 0) {
      console.log('[useAutoBackup] reconcileCompletedUploads no completed native uploads');
      return false;
    }

    for (const item of completed) {
      console.log('[useAutoBackup] reconciling completed native upload', item);
      await dbService.recordUpload(item.assetId, item.hash, item.messageId || 0, 'me');
    }

    onSyncedUploads?.();
    console.log('[useAutoBackup] reconcileCompletedUploads done');
    return true;
  }, [onSyncedUploads]);

  const refresh = useCallback(async () => {
    console.log('[useAutoBackup] refresh start');
    if (!autoBackupModule.isAvailable()) {
      console.warn('[useAutoBackup] native auto backup module unavailable during refresh');
      setStatus(EMPTY_STATUS);
      setLoading(false);
      return;
    }

    try {
      const [nextStatus] = await Promise.all([
        autoBackupModule.getStatus(),
        reconcileCompletedUploads(),
      ]);

      console.log('[useAutoBackup] refresh status', nextStatus);
      setStatus(nextStatus);
    } catch (error) {
      console.error('[useAutoBackup] refresh failed', error);
    } finally {
      setLoading(false);
    }
  }, [reconcileCompletedUploads]);

  useEffect(() => {
    refresh();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  const requestNotificationPermission = useCallback(async () => {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );

    console.log('[useAutoBackup] notification permission result', granted);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    console.log('[useAutoBackup] setEnabled called', { enabled });
    if (!autoBackupModule.isAvailable()) {
      console.warn('[useAutoBackup] setEnabled aborted because native module is unavailable');
      return;
    }

    setLoading(true);

    try {
      if (enabled) {
        await requestNotificationPermission();
      }

      const nextStatus = await autoBackupModule.setEnabled(
        enabled,
        CONFIG.BACKEND_URL,
        CONFIG.API_KEY
      );
      console.log('[useAutoBackup] setEnabled next status', nextStatus);
      setStatus(nextStatus);
    } catch (error) {
      console.error('[useAutoBackup] setEnabled failed', error);
    } finally {
      setLoading(false);
    }
  }, [requestNotificationPermission]);

  const approvePendingVideos = useCallback(async (assetIds?: string[]) => {
    console.log('[useAutoBackup] approvePendingVideos called', { assetIds });
    try {
      const nextStatus = await autoBackupModule.approvePendingVideos(assetIds);
      setStatus(nextStatus);
    } catch (error) {
      console.error('[useAutoBackup] approvePendingVideos failed', error);
    }
  }, []);

  const skipPendingVideos = useCallback(async (assetIds?: string[]) => {
    console.log('[useAutoBackup] skipPendingVideos called', { assetIds });
    try {
      const nextStatus = await autoBackupModule.skipPendingVideos(assetIds);
      setStatus(nextStatus);
    } catch (error) {
      console.error('[useAutoBackup] skipPendingVideos failed', error);
    }
  }, []);

  return useMemo(() => ({
    loading,
    status,
    setEnabled,
    refresh,
    approvePendingVideos,
    skipPendingVideos,
    pendingVideoApprovals: status.pendingVideoApprovals as NativeAutoBackupAsset[],
    isAvailable: autoBackupModule.isAvailable(),
  }), [
    approvePendingVideos,
    loading,
    refresh,
    setEnabled,
    skipPendingVideos,
    status,
  ]);
}
