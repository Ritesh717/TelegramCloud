import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LayoutGrid, Video } from 'lucide-react-native';

import { AppHeader } from '../../src/components/AppHeader';
import { DateHeader } from '../../src/components/DateHeader';
import { GalleryItem } from '../../src/components/GalleryItem';
import { MediaViewer, ViewerMedia } from '../../src/components/MediaViewer';
import { APP_CONSTANTS } from '../../src/constants/AppConstants';
import { MediaAsset, MediaSection, useMedia } from '../../src/hooks/useMedia';
import { useSyncQueue } from '../../src/hooks/useSyncQueue';
import { THEME } from '../../src/theme/theme';
import { formatSectionDate, normalizeTimestamp } from '../../src/utils/formatters';

const { width } = Dimensions.get('window');

type PhotosView = 'all' | 'memories' | 'videos' | 'backed_up' | 'not_backed_up' | 'collections';
type PhotosListRow =
  | { type: 'section'; key: string; section: MediaSection }
  | { type: 'grid'; key: string; sectionKey: string; assets: MediaAsset[] };

const buildSectionsFromAssets = (assets: MediaAsset[]): MediaSection[] => {
  const map = new Map<string, MediaSection>();

  assets.forEach((asset) => {
    const sectionDate = new Date(normalizeTimestamp(asset.normalizedCreationTime));
    sectionDate.setHours(0, 0, 0, 0);
    const key = sectionDate.toISOString();

    if (!map.has(key)) {
      map.set(key, {
        key,
        title: formatSectionDate(sectionDate.getTime()),
        timestamp: sectionDate.getTime(),
        data: [],
      });
    }

    map.get(key)!.data.push(asset);
  });

  return Array.from(map.values())
    .map((section) => ({
      ...section,
      data: [...section.data].sort((a, b) => b.normalizedCreationTime - a.normalizedCreationTime),
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
};

export default function GalleryScreen() {
  const { sections, assets, loadingInitial, loadingMore, loadMore, refresh } = useMedia();
  const { addToQueue, queueItems } = useSyncQueue();
  const [selectedAsset, setSelectedAsset] = useState<ViewerMedia | null>(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [columnCount, setColumnCount] = useState(APP_CONSTANTS.UI.GALLERY.DEFAULT_COLUMN_COUNT);
  const [view, setView] = useState<PhotosView>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayBackupRef = useRef(new Map<string, { title: string; assetIds: string[] }>());

  const itemWidth = (width - THEME.spacing.md * 2 - (columnCount - 1) * 6) / columnCount;

  const filteredAssets = useMemo(() => {
    switch (view) {
      case 'videos':
        return assets.filter((asset) => asset.mediaType === 'video');
      case 'backed_up':
        return assets.filter((asset) => asset.isUploaded);
      case 'not_backed_up':
        return assets.filter((asset) => !asset.isUploaded);
      case 'memories':
        return assets.slice(0, 60);
      case 'collections':
        return [...assets].sort((a, b) => {
          const first = a.mediaType === 'video' ? 1 : 0;
          const second = b.mediaType === 'video' ? 1 : 0;
          if (first !== second) return first - second;
          return b.normalizedCreationTime - a.normalizedCreationTime;
        });
      default:
        return assets;
    }
  }, [assets, view]);

  const activeSections = useMemo(
    () => (view === 'all' ? sections : buildSectionsFromAssets(filteredAssets)),
    [filteredAssets, sections, view]
  );

  const queueByAssetId = useMemo(() => {
    const map = new Map<string, string>();
    queueItems.forEach((item) => {
      map.set(item.assetId, item.status);
    });
    return map;
  }, [queueItems]);

  const rowData = useMemo<PhotosListRow[]>(() => {
    const rows: PhotosListRow[] = [];

    activeSections.forEach((section) => {
      rows.push({
        type: 'section',
        key: `section-${section.key}`,
        section,
      });

      for (let index = 0; index < section.data.length; index += columnCount) {
        const chunk = section.data.slice(index, index + columnCount);
        rows.push({
          type: 'grid',
          key: `grid-${section.key}-${index}`,
          sectionKey: section.key,
          assets: chunk,
        });
      }
    });

    return rows;
  }, [activeSections, columnCount]);

  const queueStateVersion = useMemo(
    () => queueItems.map((item) => `${item.assetId}:${item.status}`).join('|'),
    [queueItems]
  );

  const handleAssetPress = (asset: MediaAsset) => {
    setSelectedAsset({
      uri: asset.uri,
      filename: asset.filename,
      mediaType: asset.mediaType === 'video' ? 'video' : 'photo',
      creationTime: asset.normalizedCreationTime,
    });
    setIsViewerVisible(true);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 1000);
  };

  const isAssetBackedUp = (asset: MediaAsset) => {
    const queueItem = queueByAssetId.get(asset.id);
    return (
      asset.isUploaded ||
      queueItem === 'completed' ||
      queueItem === 'duplicate'
    );
  };

  const isSectionBackedUp = (section: MediaSection) =>
    section.data.every((asset) => isAssetBackedUp(asset));

  const handleSectionBackup = (section: MediaSection) => {
    const pendingAssets = section.data.filter((asset) => !isAssetBackedUp(asset));
    if (pendingAssets.length === 0) {
      showToast('Everything in this day is already backed up');
      return;
    }

    addToQueue(
      pendingAssets.map((asset) => ({
        ...asset,
        fileSize: asset.fileSize || 0,
      }))
    );
    dayBackupRef.current.set(section.key, {
      title: section.title,
      assetIds: pendingAssets.map((asset) => asset.id),
    });
    showToast(
      pendingAssets.length === 1
        ? '1 item added to backup queue'
        : `${pendingAssets.length} items added to backup queue`
    );
  };

  useEffect(() => {
    const completedSections: string[] = [];

    dayBackupRef.current.forEach((tracked, sectionKey) => {
      const finished = tracked.assetIds.every((assetId) => {
        const queueStatus = queueByAssetId.get(assetId);
        return queueStatus === 'completed' || queueStatus === 'duplicate';
      });

      if (finished) {
        completedSections.push(sectionKey);
      }
    });

    if (completedSections.length > 0) {
      completedSections.forEach((sectionKey) => {
        const tracked = dayBackupRef.current.get(sectionKey);
        if (tracked) {
          showToast(`${tracked.title} backed up`);
        }
        dayBackupRef.current.delete(sectionKey);
      });
      refresh();
    }
  }, [queueByAssetId, refresh]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const toggleGrid = () => {
    setColumnCount((prev) =>
      prev === APP_CONSTANTS.UI.GALLERY.DEFAULT_COLUMN_COUNT
        ? APP_CONSTANTS.UI.GALLERY.MAX_COLUMN_COUNT
        : APP_CONSTANTS.UI.GALLERY.DEFAULT_COLUMN_COUNT
    );
  };

  const activeCount = filteredAssets.filter((asset) => asset.isUploaded).length;

  const listHeader = (
    <>
      <AppHeader
        eyebrow="Device library"
        title="Photos"
        // subtitle="Browse your device library, recent highlights, videos, and already backed up items."
        rightActions={[{ icon: LayoutGrid, onPress: toggleGrid }]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Chip label="All" active={view === 'all'} onPress={() => setView('all')} />
        <Chip label="Memories" active={view === 'memories'} onPress={() => setView('memories')} />
        <Chip label="Videos" active={view === 'videos'} onPress={() => setView('videos')} />
        <Chip label="Backed up" active={view === 'backed_up'} onPress={() => setView('backed_up')} />
        <Chip label="Not backed up" active={view === 'not_backed_up'} onPress={() => setView('not_backed_up')} />
        <Chip label="Collections" active={view === 'collections'} onPress={() => setView('collections')} />
        {/* <Chip label={columnCount === 4 ? 'Comfortable grid' : 'Compact grid'} onPress={toggleGrid} /> */}
      </ScrollView>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Visible</Text>
          <Text style={styles.summaryValue}>{filteredAssets.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Backed up</Text>
          <Text style={styles.summaryValue}>{activeCount}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardLast]}>
          <Text style={styles.summaryLabel}>Videos</Text>
          <Text style={styles.summaryValue}>
            {filteredAssets.filter((asset) => asset.mediaType === 'video').length}
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.listWrap}>
        <FlashList
          data={rowData}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return (
                <DateHeader
                  title={item.section.title}
                  onAction={() => handleSectionBackup(item.section)}
                  completed={isSectionBackedUp(item.section)}
                />
              );
            }

            return (
              <View style={styles.gridRow}>
                {item.assets.map((asset) => (
                  <GalleryItem
                    key={asset.id}
                    asset={asset}
                    onPress={handleAssetPress}
                    itemWidth={itemWidth}
                  />
                ))}
                {item.assets.length < columnCount
                  ? Array.from({ length: columnCount - item.assets.length }).map((_, index) => (
                      <View key={`${item.key}-spacer-${index}`} style={{ width: itemWidth, height: itemWidth * 1.05 }} />
                    ))
                  : null}
              </View>
            );
          }}
          estimatedItemSize={itemWidth + 12}
          key={columnCount}
          extraData={{ columnCount, view, queueStateVersion }}
          refreshControl={<RefreshControl refreshing={loadingInitial} onRefresh={refresh} tintColor={THEME.colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={THEME.colors.primary} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Video size={28} color={THEME.colors.textMuted} />
              <Text style={styles.emptyTitle}>No items match this view</Text>
              <Text style={styles.emptyText}>Try a different filter or refresh your device library.</Text>
            </View>
          }
        />
      </View>

      <MediaViewer isVisible={isViewerVisible} asset={selectedAsset} onClose={() => setIsViewerVisible(false)} />
      {toastMessage ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.88}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  listWrap: {
    flex: 1,
  },
  storyStrip: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.md,
    paddingBottom: THEME.spacing.md,
  },
  storyCard: {
    flex: 1,
    minHeight: 116,
    padding: THEME.spacing.md,
    marginRight: THEME.spacing.sm,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.card,
  },
  storyCardActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#F7FAFF',
  },
  storyIcon: {
    width: 34,
    height: 34,
    borderRadius: THEME.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.sm,
  },
  storyTitle: {
    ...THEME.typography.titleSmall,
    color: THEME.colors.text,
  },
  storyText: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    marginTop: 6,
  },
  chipsRow: {
    paddingHorizontal: THEME.spacing.md,
    paddingBottom: THEME.spacing.md,
  },
  chip: {
    height: 36,
    paddingHorizontal: THEME.spacing.md,
    marginRight: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: THEME.colors.surfaceTertiary,
    borderColor: THEME.colors.surfaceTertiary,
  },
  chipText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.textSecondary,
  },
  chipTextActive: {
    color: THEME.colors.primaryStrong,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.md,
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
  listContent: {
    paddingBottom: 110,
  },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.md,
  },
  footerLoader: {
    paddingVertical: THEME.spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: THEME.spacing.xxl,
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyTitle: {
    ...THEME.typography.titleSmall,
    color: THEME.colors.text,
    marginTop: THEME.spacing.md,
  },
  emptyText: {
    ...THEME.typography.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: THEME.spacing.sm,
  },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
  },
  toast: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: 'rgba(32,33,36,0.88)',
  },
  toastText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.white,
  },
});
