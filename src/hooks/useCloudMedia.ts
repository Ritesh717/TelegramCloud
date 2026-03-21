import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { DeviceEventEmitter } from 'react-native';

import { dbService, MediaIndexRecord } from '../api/Database';
import { telegramService } from '../api/TelegramClient';
import { normalizeTimestamp } from '../utils/formatters';

export interface CloudMedia {
  id: number;
  date: number;
  message: string;
  filename: string;
  hash?: string | null;
  cachedUri?: string | null;
  savedToLibrary?: boolean;
  media: {
    type: 'photo' | 'video' | 'document';
    mimeType?: string | null;
    size: number;
    thumbnail?: string | null;
  };
}

const CLOUD_SYNC_SCOPE = 'cloud-media';

export const CLOUD_MEDIA_CACHE_DIR = `${FileSystem.cacheDirectory}cloud-media/`;

const toCloudMedia = (record: MediaIndexRecord): CloudMedia => {
  let metadata: Record<string, unknown> = {};
  if (record.metadataJson) {
    try {
      metadata = JSON.parse(record.metadataJson);
    } catch {
      metadata = {};
    }
  }

  return {
    id: record.telegramMessageId,
    date: normalizeTimestamp(record.createdAt),
    message: record.caption || '',
    filename: record.filename,
    hash: record.hash,
    cachedUri:
      typeof metadata.cachedUri === 'string'
        ? metadata.cachedUri
        : typeof metadata.localUri === 'string'
          ? metadata.localUri
          : null,
    savedToLibrary: metadata.savedToLibrary === true,
    media: {
      type: record.mediaType,
      mimeType: record.mimeType,
      size: record.size,
      thumbnail: record.thumbnailUri || null,
    },
  };
};

const updateIndexFromRemote = async (items: any[]) => {
  const records: MediaIndexRecord[] = items.map((item) => ({
    telegramMessageId: item.id,
    hash: item.hash || null,
    filename: item.filename || 'attachment',
    mediaType: item.mediaType || 'document',
    mimeType: item.mimeType || null,
    size: item.size || 0,
    caption: item.message || '',
    thumbnailUri: item.thumbnail || null,
    createdAt: normalizeTimestamp(item.date),
    syncedAt: Date.now(),
    metadataJson: null,
  }));

  await dbService.upsertMediaIndex(records);
  return records;
};

export function useCloudMedia() {
  const [media, setMedia] = useState<CloudMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const cachedUriMapRef = useRef(new Map<number, string>());
  const syncingRef = useRef(false);

  const loadFromIndex = useCallback(async () => {
    const indexed = await dbService.getIndexedMedia(5000);
    // Sort primarily by date (newest first), then by messageId (newest first)
    const mapped = indexed.map(toCloudMedia).sort((a, b) => (b.date - a.date) || (b.id - a.id));
    cachedUriMapRef.current = new Map(
      mapped
        .filter((item) => !!item.cachedUri)
        .map((item) => [item.id, item.cachedUri as string])
    );
    setMedia(mapped);
    return mapped;
  }, []);

  const syncCloudMedia = useCallback(
    async (isRefresh = false) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        // ALWAYS fetch the newest files from Telegram (offsetId 0)
        const response = await telegramService.fetchCloudMedia(100, 0);
        const items = response.media || [];
        await updateIndexFromRemote(items);
        await loadFromIndex();
      } catch (e) {
        console.error('[useCloudMedia] Error:', e);
        await loadFromIndex();
      } finally {
        setLoading(false);
        setRefreshing(false);
        syncingRef.current = false;
      }
    },
    [loadFromIndex]
  );

  const loadMoreCloudMedia = useCallback(async () => {
    if (loading || refreshing || media.length === 0) return;
    setLoading(true);
    try {
      // Find the oldest message ID we have in the current list
      const oldestId = media.reduce((min, item) => Math.min(min, item.id), media[0].id);

      // Fetch media older than the oldest message ID
      const response = await telegramService.fetchCloudMedia(100, oldestId);
      const items = (response.media || []).filter((item: any) => item.id < oldestId);
      
      if (items.length > 0) {
        await updateIndexFromRemote(items);
        await loadFromIndex();
      }
    } catch (e) {
      console.error('[loadMoreCloudMedia] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [loading, refreshing, media, loadFromIndex]);

  // Initial sync and wipe listener
  useEffect(() => {
    (async () => {
      await FileSystem.makeDirectoryAsync(CLOUD_MEDIA_CACHE_DIR, { intermediates: true }).catch(() => {});
      await loadFromIndex();
      await syncCloudMedia();
    })();

    const sub = DeviceEventEmitter.addListener('database_wiped', () => {
      setMedia([]);
      loadFromIndex();
    });

    return () => sub.remove();
  }, [loadFromIndex, syncCloudMedia]);

  const downloadToDevice = useCallback(async (item: CloudMedia) => {
    const ext = item.filename.includes('.') ? item.filename.split('.').pop() : 'bin';
    const localPath = `${CLOUD_MEDIA_CACHE_DIR}${item.id}-${Date.now()}.${ext}`;
    const uri = await telegramService.downloadCloudMedia(item.id, localPath);
    cachedUriMapRef.current.set(item.id, uri);

    await dbService.upsertMediaIndex([
      {
        telegramMessageId: item.id,
        hash: item.hash || null,
        filename: item.filename,
        mediaType: item.media.type,
        mimeType: item.media.mimeType || null,
        size: item.media.size,
        caption: item.message,
        thumbnailUri: item.media.thumbnail || null,
        createdAt: item.date,
        syncedAt: Date.now(),
        metadataJson: JSON.stringify({
          cachedUri: uri,
          savedToLibrary: item.savedToLibrary === true,
        }),
      },
    ]);

    return uri;
  }, []);

  const saveToDeviceLibrary = useCallback(async (item: CloudMedia) => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Media library permission is required to save downloads');
    }

    let uri = item.cachedUri || null;
    if (uri) {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        uri = null;
      }
    }

    if (!uri) {
      uri = await downloadToDevice(item);
    }

    await MediaLibrary.saveToLibraryAsync(uri);

    await dbService.upsertMediaIndex([
      {
        telegramMessageId: item.id,
        hash: item.hash || null,
        filename: item.filename,
        mediaType: item.media.type,
        mimeType: item.media.mimeType || null,
        size: item.media.size,
        caption: item.message,
        thumbnailUri: item.media.thumbnail || null,
        createdAt: item.date,
        syncedAt: Date.now(),
        metadataJson: JSON.stringify({
          cachedUri: uri,
          savedToLibrary: true,
        }),
      },
    ]);

    await loadFromIndex();
    return uri;
  }, [downloadToDevice, loadFromIndex]);

  const ensureLocalUri = useCallback(async (item: CloudMedia) => {
    const knownUri = cachedUriMapRef.current.get(item.id) || item.cachedUri || null;
    if (knownUri) {
      const info = await FileSystem.getInfoAsync(knownUri);
      if (info.exists) return knownUri;
    }

    const uri = await downloadToDevice(item);
    await loadFromIndex();
    return uri;
  }, [downloadToDevice, loadFromIndex]);

  return {
    media,
    loading,
    refreshing,
    refresh: () => syncCloudMedia(true),
    downloadToDevice: saveToDeviceLibrary,
    ensureLocalUri,
    loadMoreCloudMedia,
  };
}
