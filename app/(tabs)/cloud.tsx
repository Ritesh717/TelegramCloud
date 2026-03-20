import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Cloud, Download, Image as ImageIcon, PlayCircle } from 'lucide-react-native';

import { AppHeader } from '../../src/components/AppHeader';
import { MediaViewer, ViewerMedia } from '../../src/components/MediaViewer';
import { CloudMedia, useCloudMedia } from '../../src/hooks/useCloudMedia';
import { THEME } from '../../src/theme/theme';
import { formatDate, formatFileSize } from '../../src/utils/formatters';

type CloudFilter = 'all' | 'photos' | 'videos' | 'recent';

export default function CloudScreen() {
  const { media, loading, refreshing, refresh, ensureLocalUri, downloadToDevice } = useCloudMedia();
  const [filter, setFilter] = useState<CloudFilter>('all');
  const [viewerAsset, setViewerAsset] = useState<ViewerMedia | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const screenAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenAnimation, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [screenAnimation]);

  const filteredMedia = useMemo(() => {
    switch (filter) {
      case 'photos':
        return media.filter((item) => item.media.type === 'photo');
      case 'videos':
        return media.filter((item) => item.media.type === 'video');
      case 'recent':
        return media.slice(0, 25);
      default:
        return media;
    }
  }, [filter, media]);

  const handleOpenItem = async (item: CloudMedia) => {
    try {
      setDownloadingId(item.id);
      const uri = await ensureLocalUri(item);
      setViewerAsset({
        uri,
        filename: item.filename,
        mediaType: item.media.type === 'video' ? 'video' : 'photo',
        creationTime: item.date,
      });
      setViewerVisible(true);
    } catch (error: any) {
      Alert.alert('Unable to open item', error.message || 'Could not prepare this file for viewing.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownload = async (item: CloudMedia) => {
    try {
      setDownloadingId(item.id);
      await downloadToDevice(item);
      Alert.alert('Saved', `${item.filename} was saved to your device library.`);
    } catch (error: any) {
      Alert.alert('Download failed', error.message || 'Unable to save this file to your device.');
    } finally {
      setDownloadingId(null);
    }
  };

  const renderItem = ({ item }: { item: CloudMedia }) => {
    const isDownloading = downloadingId === item.id;

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={() => handleOpenItem(item)}>
        <View style={styles.thumb}>
          {item.media.type === 'video' ? (
            <PlayCircle size={32} color={THEME.colors.textMuted} />
          ) : (
            <ImageIcon size={32} color={THEME.colors.textMuted} />
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.filename}
          </Text>
          <Text style={styles.meta}>{`${formatFileSize(item.media.size)} | ${formatDate(item.date)}`}</Text>
          <Text style={styles.statusText}>
            {item.savedToLibrary
              ? 'Saved to device'
              : item.cachedUri
                ? 'Cached for preview'
                : item.media.type === 'video'
                  ? 'Video backup'
                  : 'Photo backup'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.downloadButton}
          activeOpacity={0.85}
          onPress={() => handleDownload(item)}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          ) : (
            <Download size={18} color={THEME.colors.primary} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.listWrap,
          {
            opacity: screenAnimation,
            transform: [
              {
                translateY: screenAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        {loading && !refreshing ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={styles.loaderText}>Refreshing your cloud archive...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredMedia}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, filteredMedia.length === 0 && styles.emptyList]}
            ListHeaderComponent={
              <View>
                <AppHeader eyebrow="Cloud archive" title="Cloud archive" paddingHorizontal={0} />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  <TopChip label="All items" active={filter === 'all'} onPress={() => setFilter('all')} />
                  <TopChip label="Photos" active={filter === 'photos'} onPress={() => setFilter('photos')} />
                  <TopChip label="Videos" active={filter === 'videos'} onPress={() => setFilter('videos')} />
                  <TopChip label="Recent" active={filter === 'recent'} onPress={() => setFilter('recent')} />
                </ScrollView>

                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total</Text>
                    <Text style={styles.summaryValue}>{filteredMedia.length}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Photos</Text>
                    <Text style={styles.summaryValue}>
                      {filteredMedia.filter((item) => item.media.type === 'photo').length}
                    </Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Videos </Text>
                    <Text style={styles.summaryValue}>
                      {filteredMedia.filter((item) => item.media.type === 'video').length}
                    </Text>
                  </View>
                  {/* <View style={[styles.summaryCard, styles.summaryCardLast]}>
                    <Text style={styles.summaryLabel}>Latest item</Text>
                    <Text style={styles.summaryValue} numberOfLines={1}>
                      {filteredMedia[0] ? new Date(filteredMedia[0].date).toLocaleDateString() : '-'}
                    </Text>
                  </View> */}
                </View>
              </View>
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={THEME.colors.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <Cloud size={32} color={THEME.colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No backed up items yet</Text>
                <Text style={styles.emptyText}>
                  Items you back up from your device will appear here and can be previewed or downloaded later.
                </Text>
              </View>
            }
          />
        )}
      </Animated.View>

      <MediaViewer isVisible={viewerVisible} asset={viewerAsset} onClose={() => setViewerVisible(false)} />
    </View>
  );
}

function TopChip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.topChip, active && styles.topChipActive]} activeOpacity={0.88} onPress={onPress}>
      <Text style={[styles.topChipText, active && styles.topChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    // paddingLeft: 0,
    // paddingRight: 0,
  },
  listWrap: {
    flex: 1,
  },
  chipsRow: {
    paddingHorizontal: 0,
    paddingBottom: THEME.spacing.md,
    height: 50,
  },
  topChip: {
    height: 36,
    paddingHorizontal: THEME.spacing.md,
    marginRight: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    justifyContent: 'center',
  },
  topChipActive: {
    backgroundColor: THEME.colors.surfaceTertiary,
    borderColor: THEME.colors.surfaceTertiary,
  },
  topChipText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.textSecondary,
  },
  topChipTextActive: {
    color: THEME.colors.primaryStrong,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    marginBottom: THEME.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    padding: THEME.spacing.md,
    marginRight: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.card,
  },
  summaryCardLast: {
    marginRight: 0,
  },
  summaryLabel: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
  },
  summaryValue: {
    ...THEME.typography.titleSmall,
    color: THEME.colors.text,
    marginTop: 6,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    ...THEME.typography.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.md,
  },
  listContent: {
    paddingHorizontal: THEME.spacing.md,
    paddingBottom: 120,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.card,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: THEME.spacing.md,
  },
  name: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.text,
  },
  meta: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  statusText: {
    ...THEME.typography.label,
    color: THEME.colors.primary,
    marginTop: 6,
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...THEME.typography.title,
    color: THEME.colors.text,
    marginTop: THEME.spacing.lg,
  },
  emptyText: {
    ...THEME.typography.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.sm,
    textAlign: 'center',
  },
});
