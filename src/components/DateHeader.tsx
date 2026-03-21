import React, { memo, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, Circle } from 'lucide-react-native';
import { THEME } from '../theme/theme';

interface DateHeaderProps {
  title: string;
  onAction?: () => void;
  completed?: boolean;
  loading?: boolean;
}

export const DateHeader = memo<DateHeaderProps>(function DateHeader({ title, onAction, completed = false, loading = false }) {
  const handleAction = useCallback(() => {
    onAction?.();
  }, [onAction]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onAction ? (
        <TouchableOpacity style={styles.button} onPress={handleAction} activeOpacity={0.85} disabled={loading || completed}>
          {loading ? (
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          ) : completed ? (
            <View style={[styles.circleButton, styles.circleButtonActive]}>
              <Check size={14} color={THEME.colors.white} />
            </View>
          ) : (
            <View style={styles.circleButton}>
              <Circle size={14} color={THEME.colors.primaryStrong} />
            </View>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: THEME.spacing.sm,
    marginBottom: THEME.spacing.xs,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.background,
  },
  title: {
    ...THEME.typography.titleSmall,
    color: THEME.colors.text,
    flex: 1,
  },
  button: {
    height: 28,
    width: 28,
    borderRadius: THEME.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: THEME.spacing.sm,
  },
  circleButton: {
    width: 22,
    height: 22,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleButtonActive: {
    backgroundColor: THEME.colors.primary,
  },
});
