import * as FileSystem from 'expo-file-system';
import { CONFIG } from '../constants/Config';
import { APP_CONSTANTS } from '../constants/AppConstants';

class TelegramService {
  private getBaseUrl() {
    return CONFIG.BACKEND_URL || APP_CONSTANTS.NETWORK.DEFAULT_BACKEND_URL;
  }

  private getAuthHeaders(extraHeaders: Record<string, string> = {}) {
    return CONFIG.API_KEY
      ? {
          ...extraHeaders,
          [APP_CONSTANTS.NETWORK.API_KEY_HEADER]: CONFIG.API_KEY,
        }
      : extraHeaders;
  }

  async initialize() {
    console.log('[TelegramClient] initialize called (Backend-mode)');
  }

  async sendCode(phoneNumber: string): Promise<any> {
    const response = await fetch(`${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.SEND_CODE}`, {
      method: 'POST',
      headers: this.getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || APP_CONSTANTS.ERRORS.DEFAULT_FETCH);
    }
    return data;
  }

  async signIn(phoneNumber: string, phoneCodeHash: string, code: string): Promise<any> {
    const response = await fetch(`${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.SIGN_IN}`, {
      method: 'POST',
      headers: this.getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ phoneNumber, phoneCodeHash, code }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || APP_CONSTANTS.ERRORS.DEFAULT_FETCH);
    }
    return data;
  }

  async checkPassword(password: string): Promise<any> {
    const response = await fetch(`${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.CHECK_PASSWORD}`, {
      method: 'POST',
      headers: this.getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || APP_CONSTANTS.ERRORS.DEFAULT_FETCH);
    }
    return data;
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const url = `${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.AUTH_STATUS}`;
      console.log("Validating Authentication ,URL: ", url);
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });
      // console.log("Response: ", response);
      const data = await response.json();
      console.log("Data: ", data);
      return !!data.authorized;
    } catch (e) {
      console.log("Error: ", e);
      console.error('[TelegramClient] Failed to check auth status:', e);
      return false;
    }
  }

  async uploadFile(uri: string, filename: string, fileSize: number, metadata?: any) {
    let metadataB64 = '';
    try {
      const json = JSON.stringify(metadata);
      metadataB64 = btoa(unescape(encodeURIComponent(json)));
    } catch (e) {
      console.error('[TelegramClient] Metadata encoding failed:', e);
      throw new Error('Failed to encode metadata for upload');
    }

    const url = `${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.UPLOAD}?filename=${encodeURIComponent(filename)}&fileSize=${fileSize}&metadata=${metadataB64}`;

    const response = await FileSystem.uploadAsync(url, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: this.getAuthHeaders(),
    });

    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}: ${response.body}`);
    }

    return JSON.parse(response.body);
  }

  async uploadBatch(assets: Array<{ uri: string; filename: string; hash: string; fileSize?: number; metadata?: Record<string, unknown> }>) {
    const url = `${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.UPLOAD_BATCH}`;
    const formData = new FormData();

    const manifest = assets.map((asset) => ({
      filename: asset.filename,
      hash: asset.hash,
      fileSize: asset.fileSize || 0,
      metadata: asset.metadata || {},
    }));

    formData.append('manifest', JSON.stringify(manifest));

    for (const asset of assets) {
      formData.append('files', {
        uri: asset.uri,
        name: asset.filename,
        type: 'application/octet-stream',
      } as any);
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Batch upload failed: ${text}`);
    }

    return response.json();
  }

  async fetchCloudMedia(limit = 100, offsetId = 0) {
    const response = await fetch(
      `${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.CLOUD_MEDIA}?limit=${limit}&offsetId=${offsetId}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch cloud media');
    }

    return response.json();
  }

  async downloadCloudMedia(messageId: number, destinationUri: string) {
    const url = `${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.CLOUD_MEDIA_DOWNLOAD}/${messageId}/download`;
    const response = await FileSystem.downloadAsync(url, destinationUri, {
      headers: this.getAuthHeaders(),
    });

    if (response.status !== 200) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    return response.uri;
  }

  async logout() {
    console.log('[TelegramClient] logout');
  }
}

export const telegramService = new TelegramService();
