import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Animated, StatusBar } from 'react-native';
import { ModernAlert } from '../../src/components/ModernAlert';
import { useBackup } from '../../src/hooks/useBackup';
import { Cloud, CheckCircle2, AlertCircle, PlayCircle, Loader2, Database, ShieldCheck, RefreshCw, Smartphone } from 'lucide-react-native';
import { Stack } from 'expo-router';

export default function BackupScreen() {
  const { 
    startBackup, deepScanDevice, restoreFromCloud, wipeDatabase,
    isBackingUp, isRestoring, isScanning,
    restoreProgress, restoreStatus,
    scanProgress, scanStatus,
    uploadingId, progress, backedUpCount, syncedCount, successCount, totalMediaCount 
  } = useBackup();
  const [isScanAlertVisible, setIsScanAlertVisible] = useState(false);
  const [isRestoreAlertVisible, setIsRestoreAlertVisible] = useState(false);
  const [isWipeAlertVisible, setIsWipeAlertVisible] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 40}}>
      <StatusBar barStyle="light-content" />
      
      <ModernAlert 
        visible={isScanAlertVisible || !!scanProgress}
        title="Deep Scan"
        message={scanProgress !== undefined ? "Scanning your device for previously uploaded files..." : "This will calculate file hashes to verify upload status. It may take some time. Continue?"}
        onCancel={!isScanning ? () => setIsScanAlertVisible(false) : undefined}
        onConfirm={() => {
          setIsScanAlertVisible(false);
          deepScanDevice();
        }}
        confirmText="Scan"
        progress={scanProgress}
        statusText={scanStatus}
        loading={isScanning && scanProgress === undefined}
      />

      <ModernAlert 
        visible={isRestoreAlertVisible || isRestoring}
        title="Restore from Cloud"
        message={isRestoring ? "Rebuilding local database from cloud metadata..." : "This will scan your Telegram history and rebuild the local database. Continue?"}
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
        title="Wipe Sync History?"
        message="This will clear all local records of synced files. It will NOT delete files from your device or Telegram, but the app will think NO files have been backed up yet. Continue?"
        onCancel={() => setIsWipeAlertVisible(false)}
        onConfirm={() => {
          setIsWipeAlertVisible(false);
          wipeDatabase();
        }}
        confirmText="Wipe All"
        cancelText="Keep Data"
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
      </View>
      
      {/* Dynamic Sync Status Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusIcon, { backgroundColor: successCount === totalMediaCount && totalMediaCount > 0 ? '#1e8e3e' : '#3c4043' }]}>
            {successCount === totalMediaCount && totalMediaCount > 0 ? (
              <CheckCircle2 size={24} color="#fff" />
            ) : (
              <Cloud size={24} color="#8ab4f8" />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.cardTitle}>
              {successCount === totalMediaCount && totalMediaCount > 0 ? 'Fully Synced' : 'Sync Status'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {successCount} items in Telegram Cloud
            </Text>
            {syncedCount > successCount && (
              <Text style={styles.mappedLabel}>
                +{syncedCount - successCount} items mapped locally
              </Text>
            )}
          </View>
        </View>

        {successCount < totalMediaCount && (
           <View style={styles.miniProgressBarBg}>
              <View style={[styles.miniProgressBarFill, { width: `${(successCount / (totalMediaCount || 1)) * 100}%` }]} />
           </View>
        )}
        
        <View style={styles.separator} />
        
        {isBackingUp ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.statusLabel}>Uploading...</Text>
              <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>
        ) : (
          <View style={styles.readyContainer}>
            <ShieldCheck size={32} color="#81c995" />
            <Text style={styles.readyTitle}>
              {successCount === totalMediaCount && totalMediaCount > 0 ? 'Your library is secure' : `${totalMediaCount - successCount} items pending`}
            </Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, isBackingUp && styles.buttonDisabled]} 
          onPress={startBackup}
          disabled={isBackingUp}
        >
          <Text style={styles.buttonText}>
            {isBackingUp ? 'Syncing...' : 'Back up now'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Maintenance Actions */}
      <View style={styles.maintenanceSection}>
          <Text style={styles.sectionTitle}>Maintenance Tools</Text>
          
          <TouchableOpacity 
            style={styles.maintenanceItem} 
            onPress={() => setIsScanAlertVisible(true)} 
            disabled={isBackingUp || isScanning || isRestoring}
          >
             <Smartphone size={20} color="#8ab4f8" />
             <View style={styles.itemText}>
                 <Text style={styles.itemTitle}>Deep Scan Device</Text>
                 <Text style={styles.itemSubtitle}>Verify local database integrity</Text>
             </View>
             <RefreshCw size={16} color="#5f6368" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.maintenanceItem} 
            onPress={() => setIsRestoreAlertVisible(true)} 
            disabled={isBackingUp || isScanning || isRestoring}
          >
             <Database size={20} color="#8ab4f8" />
             <View style={styles.itemText}>
                 <Text style={styles.itemTitle}>Restore from Cloud</Text>
                 <Text style={styles.itemSubtitle}>Pull metadata from Telegram</Text>
             </View>
             <RefreshCw size={16} color="#5f6368" />
          </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={styles.maintenanceSection}>
          <Text style={[styles.sectionTitle, { color: '#f28b82' }]}>Danger Zone</Text>
          
          <TouchableOpacity 
            style={styles.maintenanceItem} 
            onPress={() => setIsWipeAlertVisible(true)} 
            disabled={isBackingUp || isScanning || isRestoring}
          >
             <AlertCircle size={20} color="#f28b82" />
             <View style={styles.itemText}>
                 <Text style={[styles.itemTitle, { color: '#f28b82' }]}>Wipe Local History</Text>
                 <Text style={styles.itemSubtitle}>Start fresh (doesn't delete files)</Text>
             </View>
          </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Telegram Cloud • Unlimited Storage</Text>
        <Text style={styles.footerText}>Status: Secure Tunnel Active</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e8eaed',
  },
  card: {
    margin: 20,
    padding: 24,
    backgroundColor: '#121212',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#202124',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 16,
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e8eaed',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#9aa0a6',
    marginTop: 2,
  },
  mappedLabel: {
    fontSize: 12,
    color: '#8ab4f8',
    marginTop: 4,
    fontWeight: '500',
  },
  miniProgressBarBg: {
    height: 4,
    backgroundColor: '#202124',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
  },
  miniProgressBarFill: {
    height: '100%',
    backgroundColor: '#1e8e3e',
  },
  separator: {
    height: 1,
    backgroundColor: '#202124',
    marginBottom: 24,
  },
  readyContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  readyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e8eaed',
    marginTop: 16,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 32,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#e8eaed',
  },
  progressPercent: {
    fontSize: 14,
    color: '#8ab4f8',
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#202124',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8ab4f8',
  },
  button: {
    backgroundColor: '#8ab4f8',
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  maintenanceSection: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#bdc1c6',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  maintenanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#121212',
  },
  itemText: {
    marginLeft: 20,
    flex: 1,
  },
  itemTitle: {
    color: '#e8eaed',
    fontSize: 16,
    fontWeight: '500',
  },
  itemSubtitle: {
    color: '#9aa0a6',
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    marginTop: 48,
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 6,
    fontWeight: '500',
  },
});
