import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LucideIcon } from 'lucide-react-native';
import { THEME } from '../theme/theme';

interface HeaderAction {
  icon: LucideIcon;
  onPress?: () => void;
}

interface AppHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightActions?: HeaderAction[];
  paddingHorizontal?: number;
}

export function AppHeader({
  eyebrow,
  title,
  subtitle,
  rightActions = [],
  paddingHorizontal = THEME.spacing.md,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8, paddingHorizontal }]}>
      <View style={styles.content}>
        <View style={styles.textBlock}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {rightActions.length > 0 ? (
          <View style={styles.actions}>
            {rightActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <TouchableOpacity
                  key={`${title}-action-${index}`}
                  style={styles.actionButton}
                  onPress={action.onPress}
                  activeOpacity={0.8}
                >
                  <Icon size={20} color={THEME.colors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: THEME.spacing.md,
    backgroundColor: THEME.colors.background,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textBlock: {
    flex: 1,
    paddingRight: THEME.spacing.md,
  },
  eyebrow: {
    ...THEME.typography.label,
    color: THEME.colors.primary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    ...THEME.typography.display,
    color: THEME.colors.text,
  },
  subtitle: {
    ...THEME.typography.body,
    color: THEME.colors.textSecondary,
    marginTop: 6,
    maxWidth: 280,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  actionButton: {
    width: 42,
    height: 42,
    marginLeft: 10,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadow.card,
  },
});
