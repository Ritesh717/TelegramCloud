import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/theme';

interface DateHeaderProps {
  title: string;
  onSelect?: () => void;
}

export const DateHeader = ({ title, onSelect }: DateHeaderProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onSelect && (
        <TouchableOpacity onPress={onSelect} activeOpacity={0.7}>
          <Text style={styles.selectText}>Select</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.colors.border,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text, 
  },
  selectText: {
    fontSize: 13,
    color: THEME.colors.primary,
    fontWeight: '600',
  },
});
