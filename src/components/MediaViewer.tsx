import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ActivityIndicator, Share } from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaAsset } from '../hooks/useMedia';
import { THEME } from '../theme/theme';
import { X, Share2, Trash2, Info, Play, Pause } from 'lucide-react-native';

interface MediaViewerProps {
  isVisible: boolean;
  asset: MediaAsset | null;
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
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <X color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.headerRight}>
             <TouchableOpacity style={styles.iconButton}><Info color="#fff" size={22} /></TouchableOpacity>
             <TouchableOpacity style={styles.iconButton} onPress={handleShare}><Share2 color="#fff" size={22} /></TouchableOpacity>
             <TouchableOpacity style={styles.iconButton}><Trash2 color="#fff" size={22} /></TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading && (
            <ActivityIndicator size="large" color={THEME.colors.primary} style={styles.loader} />
          )}
          
          {isVideo ? (
            <TouchableOpacity 
              activeOpacity={1} 
              style={styles.fullMedia}
              onPress={togglePlayback}
            >
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
              {!isPlaying && !loading && (
                <View style={styles.playOverlay}>
                  <Play size={64} color="#fff" fill="rgba(255,255,255,0.4)" />
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <Image
              source={{ uri: asset.uri }}
              style={styles.fullMedia}
              contentFit="contain"
              onLoadStart={() => setLoading(true)}
              onLoad={() => setLoading(false)}
              transition={300}
            />
          )}
        </View>
        
        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
           <Text style={styles.dateText}>{new Date(asset.creationTime).toLocaleString()}</Text>
           <Text style={styles.metaText}>{asset.filename}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  headerRight: { flexDirection: 'row' },
  iconButton: { padding: 10, marginLeft: 5 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullMedia: { width: '100%', height: '100%' },
  loader: { position: 'absolute', zIndex: 5 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center'
  },
  dateText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  metaText: { color: '#ccc', fontSize: 14, marginTop: 4 }
});
