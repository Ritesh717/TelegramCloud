import '../src/polyfills';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { telegramService } from '../src/api/TelegramClient';
import { useAppStore } from '../src/store/useAppStore';
import { NAV_THEME } from '../src/theme/theme';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isReady, setIsReady] = useState(false);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setAuthenticated = useAppStore((state) => state.setAuthenticated);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      checkAuth();
    }
  }, [loaded]);

  const checkAuth = async () => {
    try {
      const authPromise = telegramService.isAuthenticated();
      const timeoutPromise = new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 5000)
      );
      const authenticated = await Promise.race([authPromise, timeoutPromise]);
      setAuthenticated(authenticated);
    } catch (e) {
      console.error('Auth check failed', e);
      setAuthenticated(false);
    } finally {
      setIsReady(true);
      SplashScreen.hideAsync();
    }
  };

  if (!loaded || !isReady) {
    return null;
  }

  return <RootLayoutNav isAuthenticated={isAuthenticated} />;
}

function RootLayoutNav({ isAuthenticated }: { isAuthenticated: boolean | null }) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated === null) return;

    if (isAuthenticated === false && segments[0] !== '(auth)') {
      const timer = setTimeout(() => {
        router.replace('/(auth)/login');
      }, Platform.OS === 'android' ? 100 : 0);
      return () => clearTimeout(timer);
    }

    if (isAuthenticated === true && segments[0] === '(auth)') {
      const timer = setTimeout(() => {
        router.replace('/(tabs)');
      }, Platform.OS === 'android' ? 100 : 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router, segments]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={NAV_THEME}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: NAV_THEME.colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
