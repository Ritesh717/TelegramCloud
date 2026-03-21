import { NativeModules, Platform } from 'react-native';

export interface NativeAutoBackupAsset {
  assetId: string;
  uri: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  mediaType: 'photo' | 'video';
  creationTime: number;
}

export interface NativeCompletedUpload {
  assetId: string;
  hash: string;
  messageId: number;
}

export interface AutoBackupStatus {
  enabled: boolean;
  startedAt: number;
  lastScanAt: number;
  lastUploadedAt: number;
  uploadedPhotoCount: number;
  pendingVideoApprovals: NativeAutoBackupAsset[];
  uploadActive: boolean;
  activeUploadCount: number;
}

type AutoBackupNativeModule = {
  getStatus(): Promise<AutoBackupStatus>;
  setEnabled(enabled: boolean, backendUrl: string, apiKey: string): Promise<AutoBackupStatus>;
  approvePendingVideos(assetIds?: string[]): Promise<AutoBackupStatus>;
  skipPendingVideos(assetIds?: string[]): Promise<AutoBackupStatus>;
  consumeCompletedUploads(): Promise<NativeCompletedUpload[]>;
};

const nativeModule = NativeModules.AutoBackupModule as AutoBackupNativeModule | undefined;

const emptyStatus = (): AutoBackupStatus => ({
  enabled: false,
  startedAt: 0,
  lastScanAt: 0,
  lastUploadedAt: 0,
  uploadedPhotoCount: 0,
  pendingVideoApprovals: [],
  uploadActive: false,
  activeUploadCount: 0,
});

export const autoBackupModule = {
  isAvailable() {
    const available = Platform.OS === 'android' && !!nativeModule;
    // console.log('[AutoBackupModule] availability', {
    //   platform: Platform.OS,
    //   hasNativeModule: !!nativeModule,
    //   available,
    //   nativeModuleKeys: nativeModule ? Object.keys(nativeModule) : [],
    // });
    return available;
  },

  async getStatus(): Promise<AutoBackupStatus> {
    if (!this.isAvailable() || !nativeModule) {
      return emptyStatus();
    }
    const status = await nativeModule.getStatus();
    // console.log('[AutoBackupModule] getStatus result', status);
    return status;
  },

  async setEnabled(enabled: boolean, backendUrl: string, apiKey: string) {
    console.log('[AutoBackupModule] setEnabled request', {
      enabled,
      backendUrl,
      hasApiKey: !!apiKey,
    });
    if (!this.isAvailable() || !nativeModule) {
      console.warn('[AutoBackupModule] setEnabled skipped because native module is unavailable');
      return emptyStatus();
    }
    const status = await nativeModule.setEnabled(enabled, backendUrl, apiKey);
    console.log('[AutoBackupModule] setEnabled result', status);
    return status;
  },

  async approvePendingVideos(assetIds?: string[]) {
    console.log('[AutoBackupModule] approvePendingVideos request', { assetIds });
    if (!this.isAvailable() || !nativeModule) {
      console.warn('[AutoBackupModule] approvePendingVideos skipped because native module is unavailable');
      return emptyStatus();
    }
    const status = await nativeModule.approvePendingVideos(assetIds);
    console.log('[AutoBackupModule] approvePendingVideos result', status);
    return status;
  },

  async skipPendingVideos(assetIds?: string[]) {
    console.log('[AutoBackupModule] skipPendingVideos request', { assetIds });
    if (!this.isAvailable() || !nativeModule) {
      console.warn('[AutoBackupModule] skipPendingVideos skipped because native module is unavailable');
      return emptyStatus();
    }
    const status = await nativeModule.skipPendingVideos(assetIds);
    console.log('[AutoBackupModule] skipPendingVideos result', status);
    return status;
  },

  async consumeCompletedUploads(): Promise<NativeCompletedUpload[]> {
    if (!this.isAvailable() || !nativeModule) {
      console.warn('[AutoBackupModule] consumeCompletedUploads skipped because native module is unavailable');
      return [];
    }
    const completed = await nativeModule.consumeCompletedUploads();
    if (completed.length > 0) {
      console.log('[AutoBackupModule] consumeCompletedUploads result', completed);
    }
    return completed;
  },
};
