import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, Circle } from 'lucide-react-native';
import { THEME } from '../theme/theme';

interface DateHeaderProps {
  title: string;
  onAction?: () => void;
  completed?: boolean;
}

export const DateHeader = ({ title, onAction, completed = false }: DateHeaderProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onAction ? (
        <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.85}>
          {completed ? (
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
};

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
