import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ResizeMode, Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Info, Play, Share2, Trash2, X } from 'lucide-react-native';

import { THEME } from '../theme/theme';
import { formatDate, normalizeTimestamp } from '../utils/formatters';

export interface ViewerMedia {
  uri: string;
  filename: string;
  mediaType: 'photo' | 'video' | 'document';
  creationTime: number;
}

interface MediaViewerProps {
  isVisible: boolean;
  asset: ViewerMedia | null;
  onClose: () => void;
}

export const MediaViewer = ({ isVisible, asset, onClose }: MediaViewerProps) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<Video>(null);

  if (!asset) return null;

  const isVideo = asset.mediaType === 'video';

  const handleShare = async () => {
    try {
      await Share.share({
        url: asset.uri,
        title: asset.filename,
      });
    } catch (error) {
      console.error('[MediaViewer] Share error:', error);
    }
  };

  const togglePlayback = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={[styles.iconButton, styles.leadingButton]} onPress={onClose} activeOpacity={0.85}>
            <X size={22} color={THEME.colors.text} />
          </TouchableOpacity>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.85}>
              <Info size={20} color={THEME.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleShare} activeOpacity={0.85}>
              <Share2 size={20} color={THEME.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.85}>
              <Trash2 size={20} color={THEME.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {loading ? <ActivityIndicator size="large" color={THEME.colors.primary} style={styles.loader} /> : null}

          {isVideo ? (
            <TouchableOpacity style={styles.fullMedia} activeOpacity={1} onPress={togglePlayback}>
              <Video
                ref={videoRef}
                source={{ uri: asset.uri }}
                style={styles.fullMedia}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
                isLooping
                onLoadStart={() => setLoading(true)}
                onLoad={() => setLoading(false)}
                onPlaybackStatusUpdate={(status) => {
                  if (status.isLoaded) {
                    setIsPlaying(status.isPlaying);
                  }
                }}
              />
              {!isPlaying && !loading ? (
                <View style={styles.playBadge}>
                  <Play size={32} color={THEME.colors.white} fill={THEME.colors.white} />
                </View>
              ) : null}
            </TouchableOpacity>
          ) : (
            <Image
              source={{ uri: asset.uri }}
              style={styles.fullMedia}
              contentFit="contain"
              onLoadStart={() => setLoading(true)}
              onLoad={() => setLoading(false)}
              transition={THEME.motion.normal}
            />
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
          <Text style={styles.dateText}>{formatDate(normalizeTimestamp(asset.creationTime))}</Text>
          <Text style={styles.metaText} numberOfLines={1}>
            {asset.filename}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  leadingButton: {
    marginLeft: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullMedia: {
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    zIndex: 2,
  },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -36,
    width: 72,
    height: 72,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: 'rgba(32,33,36,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: THEME.spacing.xl,
    paddingTop: THEME.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  dateText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.text,
  },
  metaText: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
});
