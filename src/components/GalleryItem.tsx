import React from 'react';
import { StyleSheet, Pressable, Dimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { MediaAsset } from '../hooks/useMedia';
import { Play, Cloud } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_WIDTH = width / COLUMN_COUNT;

interface GalleryItemProps {
  asset: MediaAsset;
  onPress: (asset: MediaAsset) => void;
  itemWidth: number;
}

export const GalleryItem = React.memo(({ asset, onPress, itemWidth }: GalleryItemProps) => {
  return (
    <Pressable onPress={() => onPress(asset)} style={[styles.container, { width: itemWidth, height: itemWidth, padding: 2 }]}>
      <Image
        source={{ uri: asset.uri }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      {asset.isUploaded && (
        <View style={styles.cloudBadge}>
          <Cloud size={14} color="#0088cc" fill="#0088cc" />
        </View>
      )}
      {asset.mediaType === 'video' && (
        <View style={styles.videoIcon}>
          <Play size={16} color="#fff" fill="#fff" />
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 0.5, 
  },
  image: {
    flex: 1,
    backgroundColor: '#202124',
  },
  videoIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cloudBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
