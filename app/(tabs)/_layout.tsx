import React from 'react';
import { Tabs } from 'expo-router';
import { Image as ImageIcon, Cloud, Library, CloudDownload } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import { THEME } from '../../src/theme/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: THEME.colors.text,
      tabBarInactiveTintColor: THEME.colors.textSecondary,
      tabBarStyle: {
        backgroundColor: THEME.colors.background,
        borderTopColor: THEME.colors.border,
        elevation: 0,
        height: 85,
        paddingBottom: 25,
        paddingTop: 10,
      },
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
      },
      headerShown: false,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Photos',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.pill, focused && styles.activePill]}>
              <ImageIcon color={focused ? THEME.colors.primary : color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="uploads"
        options={{
          title: 'Uploads',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.pill, focused && styles.activePill]}>
              <Cloud color={focused ? THEME.colors.primary : color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="cloud"
        options={{
          title: 'Cloud',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.pill, focused && styles.activePill]}>
              <CloudDownload color={focused ? THEME.colors.primary : color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.pill, focused && styles.activePill]}>
              <Library color={focused ? THEME.colors.primary : color} size={22} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 64,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePill: {
    backgroundColor: '#1e2b3e', // Subtle dark blue for active state
  }
});
