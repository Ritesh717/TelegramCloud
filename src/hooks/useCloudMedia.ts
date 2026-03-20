import { useState, useEffect, useCallback } from 'react';
import { telegramService } from '../api/TelegramClient';
import { CONFIG } from '../constants/Config';
import { APP_CONSTANTS } from '../constants/AppConstants';

export interface CloudMedia {
  id: number;
  date: number;
  message: string;
  media?: {
    type: 'photo' | 'video' | 'document';
    mimeType: string;
    size: number;
    thumbnail?: string;
  };
}

export function useCloudMedia() {
  const [media, setMedia] = useState<CloudMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCloudMedia = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const url = `${CONFIG.BACKEND_URL}${APP_CONSTANTS.NETWORK.API.CLOUD_MEDIA}`;
      const response = await fetch(url, {
        headers: { [APP_CONSTANTS.NETWORK.API_KEY_HEADER]: CONFIG.API_KEY }
      });
      
      if (!response.ok) throw new Error('Failed to fetch cloud media');
      
      const data = await response.json();
      setMedia(data.media || []);
    } catch (e) {
      console.error('[useCloudMedia] Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCloudMedia();
  }, [fetchCloudMedia]);

  return { media, loading, refreshing, refresh: () => fetchCloudMedia(true) };
}
