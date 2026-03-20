import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { Check, Circle, RefreshCw, RotateCcw, Scan, Video, XCircle } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import { AppHeader } from '../../src/components/AppHeader';
import { ModernAlert } from '../../src/components/ModernAlert';
import { APP_CONSTANTS } from '../../src/constants/AppConstants';
import { FetchOptions, PendingAsset, usePendingUploads } from '../../src/hooks/usePendingUploads';
import { useAutoBackup } from '../../src/hooks/useAutoBackup';
import { useSyncQueue } from '../../src/hooks/useSyncQueue';
import { NativeAutoBackupAsset } from '../../src/native/AutoBackupModule';
import { THEME } from '../../src/theme/theme';
import { formatDateLabel, formatFileSize } from '../../src/utils/formatters';

const PAGE_SIZE = APP_CONSTANTS.UI.LISTS.PAGE_SIZE;
const SCREEN_GUTTER = THEME.spacing.md;
type ActivityFilter = 'all' | 'in_progress' | 'awaiting_approval';

export default function UploadsScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { pendingAssets, loading, hasNextPage, fetchPending, scanProgress, scanStatus, totalPending } = usePendingUploads();
  const { addToQueue, uploadingIds, activeCount, queueLength, queueItems, cancelUpload, retryUpload } = useSyncQueue();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FetchOptions>({
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    sizeFilter: 'all',
    limit: PAGE_SIZE,
  });
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [isScanAlertVisible, setIsScanAlertVisible] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const handleNativeUploadSynced = React.useCallback(() => {
    fetchPending(filter, true);
  }, [fetchPending, filter]);
  const {
    status: autoBackupStatus,
    setEnabled: setAutoBackupEnabled,
    approvePendingVideos,
    skipPendingVideos,
    pendingVideoApprovals,
    loading: autoBackupLoading,
  } = useAutoBackup(handleNativeUploadSynced);

  useEffect(() => {
    fetchPending(filter, true);
  }, []);

  useEffect(() => {
    if (params.filter === 'in_progress') {
      setActivityFilter('in_progress');
    }
  }, [params.filter]);

  const lastUploadingIds = useRef(new Set<string>());
  useEffect(() => {
    const finished = [...lastUploadingIds.current].filter((id) => !uploadingIds.has(id));
    if (finished.length > 0) {
      setCompletedIds((prev) => {
        const next = new Set(prev);
        finished.forEach((id) => next.add(id));
        return next;
      });
    }
    lastUploadingIds.current = new Set(uploadingIds);
  }, [uploadingIds]);

  const queueByAssetId = useMemo(
    () => new Map(queueItems.map((item) => [item.assetId, item])),
    [queueItems]
  );

  const filteredAssets = useMemo(
    () =>
      pendingAssets.filter((asset) => {
        if (completedIds.has(asset.id)) return false;
        if (activityFilter === 'in_progress') {
          const queueItem = queueByAssetId.get(asset.id);
          return (
            uploadingIds.has(asset.id) ||
            queueItem?.status === 'queued' ||
            queueItem?.status === 'retrying' ||
            queueItem?.status === 'uploading'
          );
        }
        if (activityFilter === 'awaiting_approval') {
          return false;
        }
        return true;
      }),
    [activityFilter, completedIds, pendingAssets, queueByAssetId, uploadingIds]
  );

  const handleFilterChange = (newFilter: Partial<FetchOptions>) => {
    const updated = { ...filter, ...newFilter };
    setFilter(updated);
    setSelectedIds(new Set());
    setCompletedIds(new Set());
    fetchPending(updated, true);
  };

  const handleActivityFilterChange = (nextFilter: ActivityFilter) => {
    setActivityFilter(nextFilter);
    setSelectedIds(new Set());
  };

  const awaitingApprovalItems = useMemo(() => pendingVideoApprovals, [pendingVideoApprovals]);

  const toggleSelect = (assetId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const handleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredAssets.slice(0, PAGE_SIZE).forEach((asset) => next.add(asset.id));
      return next;
    });
  };

  const handleSyncSelected = () => {
    const selected = filteredAssets.filter((asset) => selectedIds.has(asset.id));
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

  const renderItem = ({ item }: { item: PendingAsset }) => {
    const queueItem = queueByAssetId.get(item.id);
    const isProcessing = uploadingIds.has(item.id);
    const statusLabel = queueItem
      ? queueItem.status === 'retrying'
        ? `Retrying ${queueItem.attempts}/${queueItem.maxAttempts}`
        : queueItem.status === 'failed'
          ? 'Needs attention'
          : queueItem.status === 'duplicate'
            ? 'Already backed up'
            : queueItem.status === 'cancelled'
              ? 'Cancelled'
              : queueItem.status === 'completed'
                ? 'Backed up'
                : queueItem.status === 'uploading'
                  ? `Uploading ${Math.round(queueItem.progress * 100)}%`
                  : 'Queued'
      : null;

    return (
      <TouchableOpacity
        style={[styles.item, selectedIds.has(item.id) && styles.itemSelected]}
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.88}
      >
        <View style={styles.thumbnailWrap}>
          <Image source={{ uri: item.uri }} style={styles.thumbnail} />
          {item.mediaType === MediaLibrary.MediaType.video ? (
            <View style={styles.videoBadge}>
              <Video size={12} color={THEME.colors.white} />
            </View>
          ) : null}
        </View>

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.filename}
          </Text>
          <Text style={styles.itemMeta}>{formatFileSize(item.fileSize)}</Text>
          {statusLabel ? <Text style={styles.itemStatus}>{statusLabel}</Text> : null}
          {queueItem?.errorMessage && queueItem.status === 'failed' ? (
            <Text style={styles.itemError} numberOfLines={1}>
              {queueItem.errorMessage}
            </Text>
          ) : null}
        </View>

        <View style={styles.itemAction}>
          {selectedIds.has(item.id) ? (
            <View style={[styles.selectionCircle, styles.selectionCircleActive]}>
              <Check color={THEME.colors.white} size={14} />
            </View>
          ) : isProcessing ? (
            <TouchableOpacity style={styles.roundAction} onPress={() => cancelUpload(item.id)} activeOpacity={0.85}>
              <XCircle color={THEME.colors.warning} size={20} />
            </TouchableOpacity>
          ) : queueItem?.status === 'failed' || queueItem?.status === 'cancelled' ? (
            <TouchableOpacity style={styles.roundAction} onPress={() => retryUpload(item.id)} activeOpacity={0.85}>
              <RotateCcw color={THEME.colors.primary} size={18} />
            </TouchableOpacity>
          ) : (
            <View style={styles.selectionCircle}>
              <Circle color={THEME.colors.textMuted} size={14} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderApprovalItem = ({ item }: { item: NativeAutoBackupAsset }) => (
    <View style={styles.item}>
      <View style={styles.thumbnailWrap}>
        <Image source={{ uri: item.uri }} style={styles.thumbnail} />
        <View style={styles.videoBadge}>
          <Video size={12} color={THEME.colors.white} />
        </View>
      </View>

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.filename}
        </Text>
        <Text style={styles.itemMeta}>
          {formatFileSize(item.fileSize)} - {formatDateLabel(item.creationTime)}
        </Text>
        <Text style={styles.itemStatus}>Waiting for your approval</Text>
      </View>

      <View style={styles.approvalActions}>
        <TouchableOpacity
          style={styles.approvalSecondary}
          onPress={() => skipPendingVideos([item.assetId])}
          activeOpacity={0.88}
        >
          <Text style={styles.approvalSecondaryText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.approvalPrimary}
          onPress={() => approvePendingVideos([item.assetId])}
          activeOpacity={0.88}
        >
          <Text style={styles.approvalPrimaryText}>Upload</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const listHeader = (
    <View style={styles.container}>
      <AppHeader
        eyebrow="Backup queue"
        title="Backup queue"
        paddingHorizontal={0}
        // subtitle="Review pending photos and videos, then send them to your cloud archive with a simple, reliable backup flow."
        rightActions={[
          { icon: Scan, onPress: () => setIsScanAlertVisible(true) },
          { icon: RefreshCw, onPress: handleRefresh },
        ]}
      />

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>{totalPending}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Active</Text>
          <Text style={styles.summaryValue}>{activeCount}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardLast]}>
          <Text style={styles.summaryLabel}>Queue</Text>
          <Text style={styles.summaryValue}>{queueLength}</Text>
        </View>
      </View>

      <View style={styles.autoBackupCard}>
        <View style={styles.autoBackupHeader}>
          <View style={styles.autoBackupCopy}>
            <Text style={styles.autoBackupTitle}>Auto backup for new files</Text>
            <Text style={styles.autoBackupText}>
              Future photos upload automatically. Future videos wait for confirmation before upload.
            </Text>
          </View>
          <View style={styles.autoBackupToggleWrap}>
            <Text style={styles.autoBackupToggleLabel}>
              {autoBackupStatus.enabled ? 'On' : 'Off'}
            </Text>
            <Switch
              value={autoBackupStatus.enabled}
              onValueChange={(value) => {
                console.log('[UploadsScreen] auto backup toggle changed', {
                  value,
                  currentEnabled: autoBackupStatus.enabled,
                  autoBackupLoading,
                });
                setAutoBackupEnabled(value);
              }}
              disabled={autoBackupLoading}
              trackColor={{
                false: THEME.colors.borderSoft,
                true: '#A8C7FA',
              }}
              thumbColor={autoBackupStatus.enabled ? THEME.colors.primary : THEME.colors.white}
              ios_backgroundColor={THEME.colors.borderSoft}
            />
          </View>
        </View>

        <View style={styles.autoBackupStats}>
          <View style={styles.autoBackupStat}>
            <Text style={styles.autoBackupStatLabel}>Started</Text>
            <Text style={styles.autoBackupStatValue}>
              {autoBackupStatus.startedAt ? formatDateLabel(autoBackupStatus.startedAt) : 'Not enabled'}
            </Text>
          </View>
          <View style={styles.autoBackupStat}>
            <Text style={styles.autoBackupStatLabel}>New photos uploaded</Text>
            <Text style={styles.autoBackupStatValue}>{autoBackupStatus.uploadedPhotoCount}</Text>
          </View>
          <View style={styles.autoBackupStat}>
            <Text style={styles.autoBackupStatLabel}>Videos awaiting approval</Text>
            <Text style={styles.autoBackupStatValue}>{awaitingApprovalItems.length}</Text>
          </View>
        </View>

        {awaitingApprovalItems.length > 0 ? (
          <View style={styles.autoBackupActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => approvePendingVideos(awaitingApprovalItems.map((item) => item.assetId))}
              activeOpacity={0.88}
            >
              <Text style={styles.secondaryButtonText}>Upload all videos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => skipPendingVideos(awaitingApprovalItems.map((item) => item.assetId))}
              activeOpacity={0.88}
            >
              <Text style={styles.secondaryButtonText}>Skip all videos</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>Backup queue</Text>
        <Text style={styles.insightText}>
          Review your pending media, tap once to queue it, and keep using the app while the sync queue manages retries in the background.
        </Text>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <FilterItem label="All" active={activityFilter === 'all' && filter.mediaType?.length === 2} onPress={() => {
            handleActivityFilterChange('all');
            handleFilterChange({ mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video] });
          }} />
          <FilterItem
            label="Photos"
            active={filter.mediaType?.length === 1 && filter.mediaType[0] === MediaLibrary.MediaType.photo}
            onPress={() => {
              handleActivityFilterChange('all');
              handleFilterChange({ mediaType: [MediaLibrary.MediaType.photo] });
            }}
          />
          <FilterItem
            label="Videos"
            active={filter.mediaType?.length === 1 && filter.mediaType[0] === MediaLibrary.MediaType.video}
            onPress={() => {
              handleActivityFilterChange('all');
              handleFilterChange({ mediaType: [MediaLibrary.MediaType.video] });
            }}
          />
          <FilterItem label="In progress" active={activityFilter === 'in_progress'} onPress={() => handleActivityFilterChange('in_progress')} />
          <FilterItem label="Awaiting approval" active={activityFilter === 'awaiting_approval'} onPress={() => handleActivityFilterChange('awaiting_approval')} />
          <FilterItem label="Small" active={filter.sizeFilter === 'small'} onPress={() => {
            handleActivityFilterChange('all');
            handleFilterChange({ sizeFilter: 'small' });
          }} />
          <FilterItem label="Large" active={filter.sizeFilter === 'large'} onPress={() => {
            handleActivityFilterChange('all');
            handleFilterChange({ sizeFilter: 'large' });
          }} />
        </ScrollView>
      </View>

      {activityFilter !== 'awaiting_approval' ? (
        <View style={styles.primaryActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSelectPage} activeOpacity={0.88}>
            <Text style={styles.secondaryButtonText}>Select page</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSyncSelected} activeOpacity={0.9} disabled={selectedIds.size === 0}>
            <Text style={styles.primaryButtonText}>Back up selected ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ModernAlert
        visible={isScanAlertVisible || !!scanProgress}
        title="Deep scan"
        message={
          scanProgress !== undefined
            ? 'Scanning your device for items that were already backed up before the local database existed.'
            : 'This will verify every file in your library against the cloud index. Continue?'
        }
        onCancel={!loading ? () => setIsScanAlertVisible(false) : undefined}
        onConfirm={() => {
          setIsScanAlertVisible(false);
          fetchPending({ ...filter, deepScan: true }, true);
        }}
        confirmText="Start scan"
        progress={scanProgress}
        statusText={scanStatus}
        loading={loading && scanProgress === undefined}
      />

      <FlashList
        data={(activityFilter === 'awaiting_approval' ? awaitingApprovalItems : filteredAssets) as any[]}
        renderItem={activityFilter === 'awaiting_approval' ? renderApprovalItem : renderItem as any}
        keyExtractor={(item: any) => ('assetId' in item ? item.assetId : item.id)}
        estimatedItemSize={88}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        onEndReached={activityFilter === 'awaiting_approval' ? undefined : loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          activityFilter !== 'awaiting_approval' && hasNextPage
            ? <ActivityIndicator style={styles.footerLoader} color={THEME.colors.primary} />
            : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {activityFilter === 'awaiting_approval'
                  ? 'No videos need approval right now'
                  : 'Everything here is already backed up'}
              </Text>
              <Text style={styles.emptyText}>
                {activityFilter === 'awaiting_approval'
                  ? 'New videos added after auto backup is enabled will appear here before upload.'
                  : 'New photos and videos will appear here when they still need syncing.'}
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.bottomBar}>
        {activityFilter === 'awaiting_approval' ? (
          <TouchableOpacity
            style={styles.bottomButton}
            onPress={() => approvePendingVideos(awaitingApprovalItems.map((item) => item.assetId))}
            activeOpacity={0.9}
          >
            <Text style={styles.bottomButtonText}>Upload approved videos ({awaitingApprovalItems.length})</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.bottomButton} onPress={handleSyncAllVisible} activeOpacity={0.9}>
            <Text style={styles.bottomButtonText}>Back up all visible ({filteredAssets.length})</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function FilterItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress} activeOpacity={0.88}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    marginBottom: THEME.spacing.md,
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
    ...THEME.typography.title,
    color: THEME.colors.text,
    marginTop: 6,
  },
  filterBar: {
    marginBottom: THEME.spacing.sm,
  },
  insightCard: {
    marginHorizontal: 0,
    marginBottom: THEME.spacing.md,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.lg,
    backgroundColor: THEME.colors.surfaceTertiary,
  },
  insightTitle: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.primaryStrong,
  },
  insightText: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    marginTop: 6,
  },
  autoBackupCard: {
    marginHorizontal: 0,
    marginBottom: THEME.spacing.md,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.card,
  },
  autoBackupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoBackupCopy: {
    flex: 1,
    paddingRight: THEME.spacing.md,
  },
  autoBackupTitle: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.text,
  },
  autoBackupText: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    marginTop: 6,
  },
  autoBackupToggleWrap: {
    alignItems: 'center',
  },
  autoBackupToggleLabel: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  autoBackupStats: {
    marginTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSoft,
    paddingTop: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  autoBackupStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoBackupStatLabel: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
  },
  autoBackupStatValue: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.text,
  },
  autoBackupActions: {
    flexDirection: 'row',
    marginTop: THEME.spacing.md,
  },
  filterScroll: {
    paddingHorizontal: 0,
  },
  filterChip: {
    height: 38,
    paddingHorizontal: THEME.spacing.md,
    marginRight: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: THEME.colors.surfaceTertiary,
    borderColor: THEME.colors.surfaceTertiary,
  },
  filterChipText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.textSecondary,
  },
  filterChipTextActive: {
    color: THEME.colors.primaryStrong,
  },
  primaryActions: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    marginBottom: THEME.spacing.md,
  },
  secondaryButton: {
    height: 46,
    paddingHorizontal: THEME.spacing.md,
    marginRight: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
  },
  secondaryButtonText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.text,
  },
  primaryButton: {
    flex: 1,
    height: 46,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.white,
  },
  listContent: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingBottom: 124,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.card,
  },
  itemSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#F7FAFF',
  },
  thumbnailWrap: {
    width: 66,
    height: 66,
    borderRadius: THEME.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: THEME.colors.surfaceSecondary,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 22,
    height: 22,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: 'rgba(32,33,36,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: THEME.spacing.md,
  },
  itemName: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.text,
  },
  itemMeta: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  itemStatus: {
    ...THEME.typography.label,
    color: THEME.colors.primary,
    marginTop: 6,
  },
  itemError: {
    ...THEME.typography.label,
    color: THEME.colors.error,
    marginTop: 2,
  },
  itemAction: {
    paddingHorizontal: THEME.spacing.xs,
  },
  approvalActions: {
    gap: THEME.spacing.xs,
  },
  approvalPrimary: {
    minWidth: 68,
    height: 34,
    paddingHorizontal: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalPrimaryText: {
    ...THEME.typography.label,
    color: THEME.colors.white,
  },
  approvalSecondary: {
    minWidth: 60,
    height: 34,
    paddingHorizontal: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalSecondaryText: {
    ...THEME.typography.label,
    color: THEME.colors.text,
  },
  roundAction: {
    width: 38,
    height: 38,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: THEME.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceSecondary,
  },
  selectionCircleActive: {
    backgroundColor: THEME.colors.primary,
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
    textAlign: 'center',
  },
  emptyText: {
    ...THEME.typography.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: THEME.spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: THEME.spacing.sm,
    paddingBottom: THEME.spacing.lg,
    backgroundColor: 'rgba(246,248,252,0.96)',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSoft,
  },
  bottomButton: {
    height: 50,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.primaryStrong,
  },
});
