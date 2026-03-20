import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingUploads, FetchOptions, PendingAsset } from '../../src/hooks/usePendingUploads';
import { useSyncQueue } from '../../src/hooks/useSyncQueue';
import { THEME } from '../../src/theme/theme';
import { APP_CONSTANTS } from '../../src/constants/AppConstants';
import { formatFileSize } from '../../src/utils/formatters';
import { Square, CheckSquare, RefreshCw, Scan, Video } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import { ModernAlert } from '../../src/components/ModernAlert';

const PAGE_SIZE = APP_CONSTANTS.UI.LISTS.PAGE_SIZE;

export default function UploadsScreen() {
  const insets = useSafeAreaInsets();
  const { pendingAssets, loading, hasNextPage, fetchPending, scanProgress, scanStatus } = usePendingUploads();
  const { addToQueue, uploadingIds, activeCount, queueLength } = useSyncQueue();
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FetchOptions>({
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    sizeFilter: 'all',
    limit: PAGE_SIZE
  });
  const [isScanAlertVisible, setIsScanAlertVisible] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Initial load
  useEffect(() => {
    fetchPending(filter, true);
  }, []);

  // Listen to uploadingIds changes to detect completion
  const lastUploadingIds = useRef(new Set<string>());
  useEffect(() => {
    const finished = [...lastUploadingIds.current].filter(id => !uploadingIds.has(id));
    if (finished.length > 0) {
        setCompletedIds(prev => {
            const next = new Set(prev);
            finished.forEach(id => next.add(id));
            return next;
        });
    }
    lastUploadingIds.current = new Set(uploadingIds);
  }, [uploadingIds]);

  const filteredAssets = useMemo(() => 
    pendingAssets.filter(a => !completedIds.has(a.id)),
  [pendingAssets, completedIds]);

  const handleFilterChange = (newFilter: Partial<FetchOptions>) => {
    const updated = { ...filter, ...newFilter };
    setFilter(updated);
    setSelectedIds(new Set());
    setCompletedIds(new Set());
    fetchPending(updated, true);
  };

  const toggleSelect = (assetId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const handleSelectPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredAssets.slice(0, PAGE_SIZE).forEach(a => next.add(a.id));
      return next;
    });
  };

  const handleSyncSelected = () => {
    const selected = filteredAssets.filter(a => selectedIds.has(a.id));
    if (selected.length === 0) return;
    addToQueue(selected);
    setSelectedIds(new Set());
  };

  const handleSyncAllVisible = () => {
    addToQueue(filteredAssets);
    setSelectedIds(new Set());
  };

  const loadMore = () => {
    if (hasNextPage && !loading) {
      fetchPending(filter);
    }
  };

  const handleRefresh = () => {
    setSelectedIds(new Set());
    setCompletedIds(new Set());
    fetchPending(filter, true);
  };

  const handleDeepScan = () => {
    setIsScanAlertVisible(true);
  };

  const renderItem = ({ item }: { item: PendingAsset }) => (
    <TouchableOpacity 
      style={styles.item}
      onPress={() => toggleSelect(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.thumbnailContainer}>
          <Image source={{ uri: item.uri }} style={styles.thumbnail} />
          {item.mediaType === MediaLibrary.MediaType.video && (
              <View style={styles.videoBadge}><Video size={12} color="#fff" /></View>
          )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.filename}</Text>
        <Text style={styles.size}>{formatFileSize(item.fileSize)}</Text>
      </View>
      <View style={styles.actions}>
          {uploadingIds.has(item.id) ? (
              <ActivityIndicator size="small" color={THEME.colors.primary} />
          ) : (
              selectedIds.has(item.id) ? (
                  <CheckSquare color={THEME.colors.primary} size={24} />
              ) : (
                  <Square color={THEME.colors.border} size={24} />
              )
          )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      <ModernAlert 
        visible={isScanAlertVisible || !!scanProgress}
        title="Deep Scan"
        message={scanProgress !== undefined ? "Scanning your device for previously uploaded files..." : "This will verify every file in your library against the cloud. Continue?"}
        onCancel={!loading ? () => setIsScanAlertVisible(false) : undefined}
        onConfirm={() => {
          setIsScanAlertVisible(false);
          fetchPending({ ...filter, deepScan: true }, true);
        }}
        confirmText="Scan"
        progress={scanProgress}
        statusText={scanStatus}
        loading={loading && scanProgress === undefined}
      />

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterItem 
            label="All" 
            active={filter.mediaType?.length === 2} 
            onPress={() => handleFilterChange({ mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video] })} 
          />
          <FilterItem 
            label="Photos" 
            active={filter.mediaType?.length === 1 && filter.mediaType[0] === MediaLibrary.MediaType.photo} 
            onPress={() => handleFilterChange({ mediaType: [MediaLibrary.MediaType.photo] })} 
          />
          <FilterItem 
            label="Videos" 
            active={filter.mediaType?.length === 1 && filter.mediaType[0] === MediaLibrary.MediaType.video} 
            onPress={() => handleFilterChange({ mediaType: [MediaLibrary.MediaType.video] })} 
          />
          <View style={styles.divider} />
          <FilterItem 
            label="Small (<500MB)" 
            active={filter.sizeFilter === 'small'} 
            onPress={() => handleFilterChange({ sizeFilter: 'small' })} 
          />
          <FilterItem 
            label="Large (>500MB)" 
            active={filter.sizeFilter === 'large'} 
            onPress={() => handleFilterChange({ sizeFilter: 'large' })} 
          />
        </ScrollView>
      </View>
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
            <View style={styles.stats}>
                <Text style={styles.statsText}>Pending: {filteredAssets.length}</Text>
                {activeCount > 0 && <Text style={styles.activeText}>Syncing {activeCount} files...</Text>}
            </View>
            <View style={styles.headerActions}>
                <TouchableOpacity style={styles.iconButton} onPress={handleDeepScan} disabled={loading}>
                    <Scan size={20} color={THEME.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={handleRefresh} disabled={loading}>
                    <RefreshCw size={20} color={THEME.colors.primary} />
                </TouchableOpacity>
            </View>
        </View>

        <TouchableOpacity 
            style={[styles.syncButton, selectedIds.size === 0 && styles.disabled]} 
            onPress={handleSyncSelected}
            disabled={selectedIds.size === 0}
        >
          <Text style={styles.syncButtonText}>Sync Selected ({selectedIds.size})</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <FlashList
            data={filteredAssets}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            estimatedItemSize={80}
            contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={hasNextPage ? <ActivityIndicator style={{ padding: 20 }} color={THEME.colors.primary} /> : null}
            ListEmptyComponent={!loading ? (
                <View style={styles.empty}>
                <Text style={styles.emptyText}>No pending items found.</Text>
                </View>
            ) : null}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 15 }]}>
         <TouchableOpacity style={styles.footerButton} onPress={handleSelectPage}>
            <Text style={styles.footerButtonText}>Select Page</Text>
         </TouchableOpacity>
         <TouchableOpacity 
            style={[styles.footerButton, styles.primaryButton]} 
            onPress={handleSyncAllVisible}
         >
            <Text style={styles.primaryButtonText}>Sync All ({filteredAssets.length})</Text>
         </TouchableOpacity>
      </View>
    </View>
  );
}

function FilterItem({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) {
    return (
        <TouchableOpacity style={[styles.filterItem, active && styles.filterActive]} onPress={onPress}>
            <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  filterBar: { 
    paddingVertical: THEME.spacing.sm, 
    borderBottomWidth: 1, 
    borderBottomColor: THEME.colors.border 
  },
  filterItem: { 
    paddingHorizontal: THEME.spacing.md, 
    paddingVertical: 6, 
    borderRadius: 20, 
    backgroundColor: THEME.colors.card, 
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterActive: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  filterLabel: { fontSize: 13, color: THEME.colors.textSecondary },
  filterLabelActive: { color: '#fff', fontWeight: 'bold' },
  divider: { width: 1, height: 20, backgroundColor: THEME.colors.border, marginHorizontal: 10, alignSelf: 'center' },
  header: { 
    padding: THEME.spacing.md, 
    backgroundColor: THEME.colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 10,
    backgroundColor: THEME.colors.card,
    borderRadius: 12,
    marginLeft: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  stats: { flex: 1 },
  statsText: { fontSize: 16, fontWeight: 'bold', color: THEME.colors.text },
  activeText: { fontSize: 12, color: THEME.colors.primary, marginTop: 2, fontWeight: '500' },
  syncButton: { 
    backgroundColor: THEME.colors.primary, 
    paddingVertical: 14, 
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  syncButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  disabled: { backgroundColor: THEME.colors.card, opacity: 0.5 },
  item: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    padding: THEME.spacing.sm,
    marginHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  thumbnailContainer: { width: 56, height: 56, borderRadius: THEME.borderRadius.sm, overflow: 'hidden' },
  thumbnail: { width: '100%', height: '100%' },
  videoBadge: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 2 },
  info: { flex: 1, marginLeft: THEME.spacing.md },
  name: { fontSize: 15, fontWeight: '600', color: THEME.colors.text },
  size: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },
  actions: { paddingHorizontal: THEME.spacing.sm },
  empty: { marginTop: 100, alignItems: 'center' },
  emptyText: { fontSize: 16, color: THEME.colors.textSecondary },
  footer: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    backgroundColor: THEME.colors.background, 
    padding: THEME.spacing.md, 
    flexDirection: 'row',
    borderTopWidth: 1, 
    borderTopColor: THEME.colors.border,
    justifyContent: 'space-between'
  },
  footerButton: { 
    paddingVertical: 14, 
    paddingHorizontal: THEME.spacing.md, 
    borderRadius: THEME.borderRadius.md, 
    flex: 1, 
    alignItems: 'center', 
    marginHorizontal: 5, 
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  primaryButton: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  footerButtonText: { fontSize: 14, fontWeight: '600', color: THEME.colors.text },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});
