import { useCallback, useEffect, useRef, useState } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { dbService } from '../api/Database';
import { formatSectionDate, normalizeTimestamp } from '../utils/formatters';

export interface MediaAsset extends MediaLibrary.Asset {
  isUploaded?: boolean;
  normalizedCreationTime: number;
}

export interface MediaSection {
  key: string;
  title: string;
  timestamp: number;
  data: MediaAsset[];
}

const PAGE_SIZE = 120;

const getSectionKey = (timestamp: number) => {
  const sectionTimestamp = new Date(normalizeTimestamp(timestamp));
  sectionTimestamp.setHours(0, 0, 0, 0);
  return sectionTimestamp.toISOString();
};

const appendSections = (existingSections: MediaSection[], nextAssets: MediaAsset[]) => {
  if (nextAssets.length === 0) return existingSections;

  const sections = existingSections.map((section) => ({
    ...section,
    data: [...section.data],
  }));
  const sectionMap = new Map(sections.map((section) => [section.key, section]));

  nextAssets.forEach((asset) => {
    const key = getSectionKey(asset.normalizedCreationTime);
    const sectionTimestamp = new Date(key).getTime();

    if (!sectionMap.has(key)) {
      const section: MediaSection = {
        key,
        title: formatSectionDate(sectionTimestamp),
        timestamp: sectionTimestamp,
        data: [],
      };
      sections.push(section);
      sectionMap.set(key, section);
    }

    sectionMap.get(key)!.data.push(asset);
  });

  sections.forEach((section) => {
    section.data.sort((a, b) => b.normalizedCreationTime - a.normalizedCreationTime);
  });

  return sections.sort((a, b) => b.timestamp - a.timestamp);
};

export function useMedia() {
  const [sections, setSections] = useState<MediaSection[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [permissionResponse, setPermissionResponse] =
    useState<MediaLibrary.PermissionResponse | null>(null);
  const endCursorRef = useRef<string | undefined>();
  const loadingRef = useRef(false);
  const normalizedAssetCacheRef = useRef(new Map<string, MediaAsset>());
  const uploadedIdCacheRef = useRef(new Set<string>());

  const ensurePermission = useCallback(async () => {
    let currentPermission = permissionResponse;
    if (!currentPermission) {
      try {
        currentPermission = await MediaLibrary.getPermissionsAsync();
        setPermissionResponse(currentPermission);
      } catch (e) {
        console.log('[useMedia] getPermissionsAsync failed:', e);
      }
    }

    if (currentPermission?.status !== 'granted') {
      try {
        const result = await MediaLibrary.requestPermissionsAsync();
        setPermissionResponse(result);
        return result.status === 'granted';
      } catch (e) {
        console.log('[useMedia] requestPermissionsAsync failed:', e);
        return false;
      }
    }

    return true;
  }, [permissionResponse]);

  const normalizeAssets = useCallback(async (sourceAssets: MediaLibrary.Asset[]) => {
    const uncachedIds = sourceAssets
      .map((asset) => asset.id)
      .filter((assetId) => !normalizedAssetCacheRef.current.has(assetId));

    if (uncachedIds.length > 0) {
      const uploadedSet = await dbService.batchCheckUploads(uncachedIds);
      uncachedIds.forEach((assetId) => {
        if (uploadedSet.has(assetId)) {
          uploadedIdCacheRef.current.add(assetId);
        }
      });
    }

    return sourceAssets.map((asset) => {
      const cached = normalizedAssetCacheRef.current.get(asset.id);
      const normalizedCreationTime = normalizeTimestamp(asset.creationTime);
      const normalizedAsset: MediaAsset = cached
        ? {
            ...cached,
            ...asset,
            creationTime: normalizedCreationTime,
            normalizedCreationTime,
            isUploaded: uploadedIdCacheRef.current.has(asset.id),
          }
        : {
            ...asset,
            creationTime: normalizedCreationTime,
            normalizedCreationTime,
            isUploaded: uploadedIdCacheRef.current.has(asset.id),
          };

      normalizedAssetCacheRef.current.set(asset.id, normalizedAsset);
      return normalizedAsset;
    });
  }, []);

  const fetchMediaPage = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (reset) {
      setLoadingInitial(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const granted = await ensurePermission();
      if (!granted) {
        setSections([]);
        setAssets([]);
        setHasNextPage(false);
        return;
      }

      if (reset) {
        endCursorRef.current = undefined;
        normalizedAssetCacheRef.current.clear();
        uploadedIdCacheRef.current.clear();
        setSections([]);
        setAssets([]);
        setHasNextPage(true);
      }

      const result = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        after: reset ? undefined : endCursorRef.current,
        sortBy: [[MediaLibrary.SortBy.creationTime, false] as any],
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      });

      const normalizedAssets = await normalizeAssets(result.assets);
      setTotalCount(result.totalCount ?? 0);
      endCursorRef.current = result.endCursor ?? undefined;
      setHasNextPage(result.hasNextPage);
      setAssets((prev) => (reset ? normalizedAssets : [...prev, ...normalizedAssets]));
      setSections((prev) => appendSections(reset ? [] : prev, normalizedAssets));
    } catch (error) {
      console.error('Error in fetchMedia:', error);
    } finally {
      loadingRef.current = false;
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  }, [ensurePermission, normalizeAssets]);

  useEffect(() => {
    fetchMediaPage(true);
  }, [fetchMediaPage]);

  return {
    sections,
    assets,
    totalCount,
    loading: loadingInitial,
    loadingInitial,
    loadingMore,
    hasNextPage,
    loadMore: () => {
      if (!loadingRef.current && hasNextPage) {
        fetchMediaPage(false);
      }
    },
    refresh: () => fetchMediaPage(true),
  };
}
