import { useState, useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { format, startOfDay } from 'date-fns';
import { dbService } from '../api/Database';

export interface MediaAsset extends MediaLibrary.Asset {
  isUploaded?: boolean;
}

export interface MediaSection {
  title: string;
  data: MediaAsset[];
}

export function useMedia() {
  const [sections, setSections] = useState<MediaSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionResponse, setPermissionResponse] = useState<MediaLibrary.PermissionResponse | null>(null);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      // Manual permission check
      let currentPermission = permissionResponse;
      if (!currentPermission) {
        try {
          currentPermission = await MediaLibrary.getPermissionsAsync();
          setPermissionResponse(currentPermission);
        } catch (e) {
          console.log('[useMedia] getPermissionsAsync failed (likely manifest issue):', e);
        }
      }

      if (currentPermission?.status !== 'granted') {
        try {
          const result = await MediaLibrary.requestPermissionsAsync();
          setPermissionResponse(result);
          if (result.status !== 'granted') {
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('[useMedia] requestPermissionsAsync failed:', e);
          setLoading(false);
          return;
        }
      }

      const { assets } = await MediaLibrary.getAssetsAsync({
        first: 1000, 
        sortBy: [[MediaLibrary.SortBy.creationTime, false] as any],
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      });

      // Batch check database
      const assetIds = assets.map(a => a.id);
      const uploadedSet = await dbService.batchCheckUploads(assetIds);

      // Group by date and check upload status
      const groups: { [key: string]: MediaAsset[] } = {};
      
      for (const asset of assets) {
        const isUploaded = uploadedSet.has(asset.id);
        const mediaAsset: MediaAsset = { ...asset, isUploaded };

        const date = new Date(asset.creationTime);
        const dateKey = format(startOfDay(date), 'MMMM d, yyyy');
        
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(mediaAsset);
      }

      const sectionedData = Object.keys(groups).map((date) => ({
        title: date,
        data: groups[date],
      }));

      setSections(sectionedData);
    } catch (error) {
      console.error('Error in fetchMedia:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  return { sections, loading, refresh: fetchMedia };
}
