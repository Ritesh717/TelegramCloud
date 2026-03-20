import { CONFIG } from '../constants/Config';
import { APP_CONSTANTS } from '../constants/AppConstants';
import * as FileSystem from 'expo-file-system';

/**
 * Refactored TelegramService that proxies calls to the Node.js backend.
 * This avoids MTProto/Stream issues in React Native.
 */
class TelegramService {
  private getBaseUrl() {
    return CONFIG.BACKEND_URL || APP_CONSTANTS.NETWORK.DEFAULT_BACKEND_URL;
  }

  async initialize() {
    console.log('[TelegramClient] initialize called (Backend-mode)');
  }

  async sendCode(phoneNumber: string): Promise<any> {
    const response = await fetch(`${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.SEND_CODE}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        [APP_CONSTANTS.NETWORK.API_KEY_HEADER]: CONFIG.API_KEY
      },
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
      headers: { 
        'Content-Type': 'application/json',
        [APP_CONSTANTS.NETWORK.API_KEY_HEADER]: CONFIG.API_KEY
      },
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
      headers: { 
        'Content-Type': 'application/json',
        [APP_CONSTANTS.NETWORK.API_KEY_HEADER]: CONFIG.API_KEY
      },
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
      const response = await fetch(`${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.AUTH_STATUS}`, {
        headers: { [APP_CONSTANTS.NETWORK.API_KEY_HEADER]: CONFIG.API_KEY }
      });
      const data = await response.json();
      return !!data.authorized;
    } catch (e) {
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
      console.warn('[TelegramClient] Metadata encoding failed:', e);
    }

    const url = `${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.UPLOAD}?filename=${encodeURIComponent(filename)}&fileSize=${fileSize}&metadata=${metadataB64}`;

    const response = await FileSystem.uploadAsync(url, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        [APP_CONSTANTS.NETWORK.API_KEY_HEADER]: CONFIG.API_KEY,
      },
    });

    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}: ${response.body}`);
    }

    return JSON.parse(response.body);
  }

  async uploadBatch(assets: { uri: string, filename: string, hash: string }[]) {
    const url = `${this.getBaseUrl()}${APP_CONSTANTS.NETWORK.API.UPLOAD_BATCH}`;
    
    const formData = new FormData();
    for (const asset of assets) {
      formData.append('files', {
        uri: asset.uri,
        name: asset.filename,
        type: 'application/octet-stream'
      } as any);
      formData.append('hashes', asset.hash);
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        [APP_CONSTANTS.NETWORK.API_KEY_HEADER]: CONFIG.API_KEY,
      },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Batch upload failed: ${text}`);
    }

    return await response.json();
  }

  async logout() {
    console.log('[TelegramClient] logout');
  }
}

export const telegramService = new TelegramService();
