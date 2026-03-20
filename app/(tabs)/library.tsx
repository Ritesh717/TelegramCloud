import React, { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Database,
  Eraser,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';

import { dbService } from '../../src/api/Database';
import { AppHeader } from '../../src/components/AppHeader';
import { ModernAlert } from '../../src/components/ModernAlert';
import { APP_CONSTANTS } from '../../src/constants/AppConstants';
import { useBackup } from '../../src/hooks/useBackup';
import { CLOUD_MEDIA_CACHE_DIR } from '../../src/hooks/useCloudMedia';
import { THEME } from '../../src/theme/theme';
import { formatFileSize } from '../../src/utils/formatters';

interface StorageSummary {
  cacheBytes: number;
  cacheFiles: number;
  databaseBytes: number;
  uploadedCount: number;
  indexedCount: number;
  queuedCount: number;
}

const EMPTY_STORAGE_SUMMARY: StorageSummary = {
  cacheBytes: 0,
  cacheFiles: 0,
  databaseBytes: 0,
  uploadedCount: 0,
  indexedCount: 0,
  queuedCount: 0,
};

const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;

async function getDirectoryStats(directory: string): Promise<{ bytes: number; files: number }> {
  try {
    const info = await FileSystem.getInfoAsync(directory);
    if (!info.exists || !info.isDirectory) {
      return { bytes: 0, files: 0 };
    }

    const entries = await FileSystem.readDirectoryAsync(directory);
    let bytes = 0;
    let files = 0;

    for (const entry of entries) {
      const entryPath = `${directory}${entry}`;
      const entryInfo = await FileSystem.getInfoAsync(entryPath);
      if (!entryInfo.exists) continue;

      if (entryInfo.isDirectory) {
        const nested = await getDirectoryStats(`${entryPath}/`);
        bytes += nested.bytes;
        files += nested.files;
      } else {
        bytes += entryInfo.size ?? 0;
        files += 1;
      }
    }

    return { bytes, files };
  } catch {
    return { bytes: 0, files: 0 };
  }
}

async function getDatabaseBytes() {
  const candidates = [
    `${SQLITE_DIR}${APP_CONSTANTS.DATABASE.NAME}`,
    `${SQLITE_DIR}${APP_CONSTANTS.DATABASE.NAME}-wal`,
    `${SQLITE_DIR}${APP_CONSTANTS.DATABASE.NAME}-shm`,
    `${SQLITE_DIR}${APP_CONSTANTS.DATABASE.NAME}.db`,
    `${SQLITE_DIR}${APP_CONSTANTS.DATABASE.NAME}.db-wal`,
    `${SQLITE_DIR}${APP_CONSTANTS.DATABASE.NAME}.db-shm`,
  ];

  let total = 0;
  for (const candidate of candidates) {
    try {
      const info = await FileSystem.getInfoAsync(candidate);
      if (info.exists && !info.isDirectory) {
        total += info.size ?? 0;
      }
    } catch {
      // Ignore missing variants.
    }
  }

  return total;
}

export default function BackupScreen() {
  const {
    startBackup,
    deepScanDevice,
    restoreFromCloud,
    wipeDatabase,
    isBackingUp,
    isRestoring,
    isScanning,
    restoreProgress,
    restoreStatus,
    scanProgress,
    scanStatus,
    progress,
    syncedCount,
    successCount,
    totalMediaCount,
  } = useBackup();

  const [isScanAlertVisible, setIsScanAlertVisible] = useState(false);
  const [isRestoreAlertVisible, setIsRestoreAlertVisible] = useState(false);
  const [isWipeAlertVisible, setIsWipeAlertVisible] = useState(false);
  const [isClearCacheAlertVisible, setIsClearCacheAlertVisible] = useState(false);
  const [storageSummary, setStorageSummary] = useState<StorageSummary>(EMPTY_STORAGE_SUMMARY);
  const [isStorageLoading, setIsStorageLoading] = useState(false);

  const fullySynced = successCount === totalMediaCount && totalMediaCount > 0;

  const loadStorageSummary = useCallback(async () => {
    setIsStorageLoading(true);
    try {
      const [{ bytes: cacheBytes, files: cacheFiles }, databaseBytes, localSummary] = await Promise.all([
        getDirectoryStats(CLOUD_MEDIA_CACHE_DIR),
        getDatabaseBytes(),
        dbService.getLocalDataSummary(),
      ]);

      setStorageSummary({
        cacheBytes,
        cacheFiles,
        databaseBytes,
        uploadedCount: localSummary.uploadedCount,
        indexedCount: localSummary.indexedCount,
        queuedCount: localSummary.queuedCount,
      });
    } finally {
      setIsStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorageSummary();
  }, [loadStorageSummary]);

  const clearPreviewCache = useCallback(async () => {
    await FileSystem.deleteAsync(CLOUD_MEDIA_CACHE_DIR, { idempotent: true }).catch(() => {});
    await FileSystem.makeDirectoryAsync(CLOUD_MEDIA_CACHE_DIR, { intermediates: true }).catch(() => {});
    await dbService.clearCachedMediaReferences();
    await loadStorageSummary();
  }, [loadStorageSummary]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="dark-content" />

      <ModernAlert
        visible={isScanAlertVisible || !!scanProgress}
        title="Deep scan device"
        message={
          scanProgress !== undefined
            ? 'Scanning your device for previously uploaded files...'
            : 'This verifies the local index against your device library and catches anything already backed up.'
        }
        onCancel={!isScanning ? () => setIsScanAlertVisible(false) : undefined}
        onConfirm={() => {
          setIsScanAlertVisible(false);
          deepScanDevice();
        }}
        confirmText="Run scan"
        progress={scanProgress}
        statusText={scanStatus}
        loading={isScanning && scanProgress === undefined}
      />

      <ModernAlert
        visible={isRestoreAlertVisible || isRestoring}
        title="Restore from cloud"
        message={
          isRestoring
            ? 'Rebuilding your local library index from cloud metadata...'
            : 'This scans your cloud archive and restores the metadata needed for a fast local library.'
        }
        onCancel={!isRestoring ? () => setIsRestoreAlertVisible(false) : undefined}
        onConfirm={() => {
          setIsRestoreAlertVisible(false);
          restoreFromCloud();
        }}
        confirmText="Restore"
        progress={restoreProgress}
        statusText={restoreStatus}
        loading={isRestoring && restoreProgress === undefined}
      />

      <ModernAlert
        visible={isWipeAlertVisible}
        title="Wipe local history?"
        message="This clears local sync records only. Your device files and cloud uploads will stay intact."
        onCancel={() => setIsWipeAlertVisible(false)}
        onConfirm={async () => {
          setIsWipeAlertVisible(false);
          await wipeDatabase();
          await loadStorageSummary();
        }}
        confirmText="Wipe local data"
        cancelText="Keep data"
      />

      <ModernAlert
        visible={isClearCacheAlertVisible}
        title="Clear preview cache?"
        message="This removes temporary preview files from the app cache. Your cloud archive and saved device files will stay intact."
        onCancel={() => setIsClearCacheAlertVisible(false)}
        onConfirm={async () => {
          setIsClearCacheAlertVisible(false);
          await clearPreviewCache();
        }}
        confirmText="Clear cache"
        cancelText="Keep cache"
      />

      <AppHeader
        eyebrow="Backup health"
        title="Backup center"
        subtitle="Check your backup status, scan your device library, restore local records, and manage app storage."
      />

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={[styles.heroIcon, { backgroundColor: fullySynced ? '#D7F8E3' : '#D3E3FD' }]}>
            {fullySynced ? (
              <CheckCircle2 size={26} color={THEME.colors.success} />
            ) : (
              <Cloud size={26} color={THEME.colors.primary} />
            )}
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{fullySynced ? 'All items backed up' : 'Backup in progress'}</Text>
            <Text style={styles.heroSubtitle}>{successCount} cloud items indexed locally</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((successCount || 0) / (totalMediaCount || 1)) * 100}%` }]} />
        </View>

        <View style={styles.metricsRow}>
          <Metric label="Cloud" value={successCount} />
          <Metric label="Tracked" value={syncedCount} />
          <Metric label="Total" value={totalMediaCount} />
        </View>

        <View style={styles.heroStatus}>
          <ShieldCheck size={18} color={THEME.colors.accent} />
          <Text style={styles.heroStatusText}>
            {isBackingUp
              ? `Backing up now | ${Math.round(progress)}%`
              : fullySynced
                ? 'Everything is protected and indexed.'
                : `${Math.max(totalMediaCount - successCount, 0)} items still need backup.`}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={startBackup} disabled={isBackingUp} activeOpacity={0.9}>
          <Text style={styles.primaryButtonText}>{isBackingUp ? 'Backing up...' : 'Back up now'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.infoChip}>
          <RefreshCw size={14} color={THEME.colors.primaryStrong} />
          <Text style={styles.infoChipText}>Index restore</Text>
        </View>
        <View style={styles.infoChip}>
          <Smartphone size={14} color={THEME.colors.primaryStrong} />
          <Text style={styles.infoChipText}>Device scan</Text>
        </View>
        <View style={styles.infoChip}>
          <HardDrive size={14} color={THEME.colors.primaryStrong} />
          <Text style={styles.infoChipText}>Local storage</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Local storage</Text>
      <View style={styles.storageRow}>
        <StorageCard
          icon={<Cloud size={18} color={THEME.colors.primary} />}
          label="Preview cache"
          value={formatFileSize(storageSummary.cacheBytes)}
          helper={`${storageSummary.cacheFiles} cached files`}
          loading={isStorageLoading}
        />
        <StorageCard
          icon={<Database size={18} color={THEME.colors.primary} />}
          label="Stored data"
          value={formatFileSize(storageSummary.databaseBytes)}
          helper={`${storageSummary.indexedCount} indexed items`}
          loading={isStorageLoading}
        />
      </View>

      <View style={styles.storageMetricsRow}>
        <Metric label="Indexed" value={storageSummary.indexedCount} />
        <Metric label="Uploads" value={storageSummary.uploadedCount} />
        <Metric label="Queue" value={storageSummary.queuedCount} />
      </View>

      <ActionCard
        icon={<Eraser size={20} color={THEME.colors.primary} />}
        title="Clear preview cache"
        subtitle="Remove temporary preview files to reduce heavy loading and free app storage."
        action="Clear"
        onPress={() => setIsClearCacheAlertVisible(true)}
      />

      <Text style={styles.sectionTitle}>Maintenance</Text>
      <ActionCard
        icon={<Smartphone size={20} color={THEME.colors.primary} />}
        title="Deep scan device"
        subtitle="Verify local records against your full device library."
        action="Scan"
        onPress={() => setIsScanAlertVisible(true)}
      />
      <ActionCard
        icon={<Database size={20} color={THEME.colors.primary} />}
        title="Restore from cloud"
        subtitle="Rebuild the local index from cloud metadata."
        action="Restore"
        onPress={() => setIsRestoreAlertVisible(true)}
      />
      <ActionCard
        icon={<AlertCircle size={20} color={THEME.colors.error} />}
        title="Wipe local history"
        subtitle="Reset local sync knowledge without touching cloud files."
        action="Wipe"
        onPress={() => setIsWipeAlertVisible(true)}
        destructive
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Manage your backup status, local cache, device scan, and restore tools from one place.
        </Text>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StorageCard({
  icon,
  label,
  value,
  helper,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  loading?: boolean;
}) {
  return (
    <View style={styles.storageCard}>
      <View style={styles.storageIcon}>{icon}</View>
      <Text style={styles.storageLabel}>{label}</Text>
      <Text style={styles.storageValue}>{loading ? 'Loading...' : value}</Text>
      <Text style={styles.storageHelper}>{loading ? 'Checking local files...' : helper}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  action,
  onPress,
  destructive = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.actionBody}>
        <Text style={[styles.actionTitle, destructive && { color: THEME.colors.error }]}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.actionPill, destructive && styles.actionPillDanger]}>
        <Text style={[styles.actionPillText, destructive && styles.actionPillDangerText]}>{action}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    paddingBottom: 120,
  },
  heroCard: {
    marginHorizontal: THEME.spacing.md,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.xl,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.soft,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: THEME.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    marginLeft: THEME.spacing.md,
    flex: 1,
  },
  heroTitle: {
    ...THEME.typography.titleSmall,
    color: THEME.colors.text,
  },
  heroSubtitle: {
    ...THEME.typography.body,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceSecondary,
    marginTop: THEME.spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: THEME.spacing.md,
  },
  metric: {
    flex: 1,
  },
  metricValue: {
    ...THEME.typography.title,
    color: THEME.colors.text,
  },
  metricLabel: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  heroStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: THEME.spacing.md,
  },
  heroStatusText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.textSecondary,
    marginLeft: THEME.spacing.sm,
    flex: 1,
  },
  primaryButton: {
    marginTop: THEME.spacing.md,
    height: 50,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.white,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: THEME.spacing.md,
    marginRight: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceTertiary,
  },
  infoChipText: {
    ...THEME.typography.label,
    color: THEME.colors.primaryStrong,
    marginLeft: 6,
  },
  sectionTitle: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: THEME.spacing.xl,
    marginBottom: THEME.spacing.sm,
    marginHorizontal: THEME.spacing.md,
  },
  storageRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  storageCard: {
    flex: 1,
    minHeight: 136,
    marginRight: THEME.spacing.sm,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.card,
  },
  storageIcon: {
    width: 34,
    height: 34,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.sm,
  },
  storageLabel: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
  },
  storageValue: {
    ...THEME.typography.titleSmall,
    color: THEME.colors.text,
    marginTop: 6,
  },
  storageHelper: {
    ...THEME.typography.label,
    color: THEME.colors.textMuted,
    marginTop: 6,
  },
  storageMetricsRow: {
    flexDirection: 'row',
    marginHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.card,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: {
    flex: 1,
    marginLeft: THEME.spacing.md,
  },
  actionTitle: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.text,
  },
  actionSubtitle: {
    ...THEME.typography.label,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  actionPill: {
    minWidth: 78,
    height: 36,
    paddingHorizontal: THEME.spacing.md,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillDanger: {
    backgroundColor: '#FCE8E6',
  },
  actionPillText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.primaryStrong,
  },
  actionPillDangerText: {
    color: THEME.colors.error,
  },
  footer: {
    alignItems: 'center',
    marginTop: THEME.spacing.xl,
    paddingHorizontal: THEME.spacing.xl,
  },
  footerText: {
    ...THEME.typography.label,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
});
