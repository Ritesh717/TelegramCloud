import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { THEME } from '../theme/theme';

interface ModernAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  progress?: number;
  statusText?: string;
  loading?: boolean;
}

export function ModernAlert({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  confirmText = 'Continue',
  cancelText = 'Not now',
  progress,
  statusText,
  loading,
}: ModernAlertProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: THEME.motion.normal,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: THEME.motion.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {(loading || progress !== undefined) && (
            <View style={styles.progressSection}>
              {progress !== undefined ? (
                <>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.helper}>{statusText || `${Math.round(progress)}% complete`}</Text>
                </>
              ) : (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={THEME.colors.primary} />
                  <Text style={styles.helper}>{statusText || 'Working...'}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.actions}>
            {onCancel && !loading && progress === undefined ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={onCancel} activeOpacity={0.85}>
                <Text style={styles.secondaryLabel}>{cancelText}</Text>
              </TouchableOpacity>
            ) : null}

            {onConfirm && !loading && progress === undefined ? (
              <TouchableOpacity style={styles.primaryButton} onPress={onConfirm} activeOpacity={0.9}>
                <Text style={styles.primaryLabel}>{confirmText}</Text>
              </TouchableOpacity>
            ) : null}

            {(loading || progress !== undefined) && (
              <Text style={styles.footerNote}>Keep the app open while this finishes.</Text>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.scrim,
    padding: THEME.spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.soft,
  },
  title: {
    ...THEME.typography.titleSmall,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.sm,
  },
  message: {
    ...THEME.typography.body,
    color: THEME.colors.textSecondary,
  },
  progressSection: {
    marginTop: THEME.spacing.lg,
  },
  progressTrack: {
    height: 8,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceSecondary,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.primary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helper: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.primary,
    marginTop: THEME.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: THEME.spacing.lg,
  },
  secondaryButton: {
    height: 42,
    paddingHorizontal: THEME.spacing.md,
    borderRadius: THEME.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.sm,
  },
  secondaryLabel: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.primary,
  },
  primaryButton: {
    height: 42,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
  },
  primaryLabel: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.white,
  },
  footerNote: {
    ...THEME.typography.label,
    color: THEME.colors.textMuted,
  },
});
