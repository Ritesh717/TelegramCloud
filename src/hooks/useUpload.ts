import { useState, useCallback } from 'react';
import { telegramService } from '../api/TelegramClient';
import { dbService } from '../api/Database';
import { computeFileHash } from '../utils/HashUtils';
import { MediaAsset } from './useMedia';

export function useUpload() {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadAsset = useCallback(async (asset: MediaAsset) => {
    setUploadingId(asset.id);
    setProgress(0);

    try {
      // 1. Compute Hash
      const hash = await computeFileHash(asset.uri);
      
      // 2. Check Deduplication
      const isUploaded = await dbService.isFileUploaded(hash);
      if (isUploaded) {
        console.log('File already uploaded, skipping:', asset.filename);
        return { success: true, skipped: true };
      }

      // 3. Get File Size & Metadata
      let fileSize = 0;
      let metadata: any = {};
      try {
        const info = await (require('expo-file-system') as any).getInfoAsync(asset.uri);
        fileSize = info.size || 0;

        // Collect extra metadata from MediaLibrary
        const assetInfo = await (require('expo-media-library') as any).getAssetInfoAsync(asset);
        if (assetInfo.location) {
          metadata.location = assetInfo.location;
        }
        metadata.mediaType = asset.mediaType;
        metadata.creationTime = asset.creationTime;
      } catch (e) {
        console.warn('[useUpload] Could not get extended metadata:', asset.uri, e);
      }
 
      // 4. Upload File (Proxied via backend)
      const result = await telegramService.uploadFile(asset.uri, asset.filename, fileSize, metadata);

      // 6. Record in Database
      // Note: result.id is the Telegram message ID
      await dbService.recordUpload(asset.id, hash, (result as any).id, 'me');

      return { success: true, skipped: false };
    } catch (error) {
      console.error('Upload failed for asset:', asset.id, error);
      throw error;
    } finally {
      setUploadingId(null);
      setProgress(0);
    }
  }, []);

  return { uploadAsset, uploadingId, progress };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
