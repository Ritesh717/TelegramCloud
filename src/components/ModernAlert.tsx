import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';

interface ModernAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  progress?: number; // 0 to 100
  statusText?: string;
  loading?: boolean;
}

export function ModernAlert({ 
  visible, 
  title, 
  message, 
  onCancel, 
  onConfirm, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  progress,
  statusText,
  loading
}: ModernAlertProps) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.alertCard}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          {(loading || progress !== undefined) && (
            <View style={styles.progressSection}>
              {progress !== undefined ? (
                <>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.statusLabel}>{statusText || `${Math.round(progress)}%`}</Text>
                </>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#8ab4f8" size="small" />
                  <Text style={styles.statusLabel}>{statusText || 'Processing...'}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.buttonContainer}>
            {onCancel && !loading && progress === undefined && (
              <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            {onConfirm && !loading && progress === undefined && (
              <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
                <Text style={styles.confirmText}>{confirmText}</Text>
              </TouchableOpacity>
            )}

            {(loading || progress !== undefined) && (
               <Text style={styles.footerInfo}>Please keep the app open</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    width: '100%',
    backgroundColor: '#1c1c1e',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#303134',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e8eaed',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#9aa0a6',
    lineHeight: 22,
    marginBottom: 24,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#303134',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8ab4f8',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#8ab4f8',
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 40,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 8,
  },
  cancelText: {
    color: '#8ab4f8',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  confirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#303134',
    borderRadius: 12,
  },
  confirmText: {
    color: '#8ab4f8',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  footerInfo: {
    color: '#5f6368',
    fontSize: 12,
    fontStyle: 'italic',
  }
});
