import '../src/polyfills';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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
      const { telegramService } = require('../src/api/TelegramClient');
      
      // Add a timeout so network failures don't block app launch
      const authPromise = telegramService.isAuthenticated();
      const timeoutPromise = new Promise<boolean>((resolve) => 
        setTimeout(() => resolve(false), 5000)
      );
      
      const authenticated = await Promise.race([authPromise, timeoutPromise]);
      setIsAuthenticated(authenticated);
    } catch (e) {
      console.error('Auth check failed', e);
      setIsAuthenticated(false);
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
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated === false && segments[0] !== '(auth)') {
      console.log('[RootLayout] Not authenticated, redirecting to login...');
      // Use a small timeout on Android to ensure the root transition is stable
      const timer = setTimeout(() => {
        router.replace('/(auth)/login');
      }, Platform.OS === 'android' ? 100 : 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
