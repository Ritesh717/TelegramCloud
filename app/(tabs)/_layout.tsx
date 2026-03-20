import React, { useEffect, useMemo, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Cloud, CloudDownload, Image as ImageIcon, Library } from 'lucide-react-native';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { THEME } from '../../src/theme/theme';
import { dbService, QueueStatus } from '../../src/api/Database';
import { autoBackupModule } from '../../src/native/AutoBackupModule';

const TAB_META: Record<
  string,
  { title: string; Icon: React.ComponentType<{ color?: string; size?: number }> }
> = {
  index: { title: 'Photos', Icon: ImageIcon },
  uploads: { title: 'Backup', Icon: Cloud },
  cloud: { title: 'Cloud', Icon: CloudDownload },
  library: { title: 'Library', Icon: Library },
};

function TabIcon({
  focused,
  color,
  routeName,
  animatedValue,
  highlight,
}: {
  focused: boolean;
  color: string;
  routeName: string;
  animatedValue?: Animated.Value;
  highlight?: boolean;
}) {
  const Icon = TAB_META[routeName]?.Icon || ImageIcon;
  const animatedStyle =
    routeName === 'uploads' && animatedValue
      ? {
          transform: [
            {
              scale: animatedValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.1, 1],
              }),
            },
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, -1.5, 0],
              }),
            },
          ],
        }
      : undefined;

  return (
    <Animated.View style={[styles.pill, focused && styles.pillActive, highlight && styles.pillHighlight, animatedStyle]}>
      <Icon color={focused || highlight ? THEME.colors.primary : color} size={20} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const backupAnimation = useRef(new Animated.Value(0)).current;
  const backupLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [queueStatuses, setQueueStatuses] = React.useState<QueueStatus[]>([]);
  const [nativeUploadActive, setNativeUploadActive] = React.useState(false);

  useEffect(() => {
    let mounted = true;

    const refreshQueueSnapshot = async () => {
      const [snapshot, nativeStatus] = await Promise.all([
        dbService.getQueueSnapshot(),
        autoBackupModule.getStatus(),
      ]);
      if (!mounted) return;
      setQueueStatuses(snapshot.items.map((item) => item.status));
      setNativeUploadActive(nativeStatus.uploadActive || nativeStatus.activeUploadCount > 0);
    };

    refreshQueueSnapshot();
    const interval = setInterval(refreshQueueSnapshot, 1500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const hasInProgressUploads = useMemo(
    () =>
      nativeUploadActive ||
      queueStatuses.some((status) => status === 'queued' || status === 'retrying' || status === 'uploading'),
    [nativeUploadActive, queueStatuses]
  );

  useEffect(() => {
    if (hasInProgressUploads) {
      if (backupLoopRef.current) {
        return;
      }

      backupLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(backupAnimation, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(backupAnimation, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      backupLoopRef.current.start();
    } else {
      backupLoopRef.current?.stop();
      backupLoopRef.current = null;
      backupAnimation.setValue(0);
    }
  }, [backupAnimation, hasInProgressUploads]);

  useEffect(() => {
    return () => {
      backupLoopRef.current?.stop();
      backupLoopRef.current = null;
      backupAnimation.setValue(0);
    };
  }, [backupAnimation]);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: THEME.colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        sceneStyle: { backgroundColor: THEME.colors.background },
        title: TAB_META[route.name]?.title || route.name,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon
            focused={focused}
            color={color}
            routeName={route.name}
            animatedValue={route.name === 'uploads' ? backupAnimation : undefined}
            highlight={route.name === 'uploads' && hasInProgressUploads}
          />
        ),
        tabBarButton: (props) => {
          if (route.name !== 'uploads') {
            return <Pressable {...props} />;
          }

          return (
            <Pressable
              {...props}
              onPress={() => {
                router.navigate({
                  pathname: '/(tabs)/uploads',
                  params: hasInProgressUploads ? { filter: 'in_progress' } : {},
                });
              }}
            />
          );
        },
      })}
    />
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 86,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderSoft,
    elevation: 0,
    ...THEME.shadow.soft,
  },
  tabBarItem: {
    paddingVertical: 4,
  },
  tabBarLabel: {
    ...THEME.typography.label,
    marginTop: 3,
  },
  pill: {
    minWidth: 64,
    height: 34,
    borderRadius: THEME.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: THEME.colors.surfaceTertiary,
  },
  pillHighlight: {
    backgroundColor: '#E8F0FE',
  },
});
