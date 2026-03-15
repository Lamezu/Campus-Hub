import React, { useEffect, useRef } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { UserProvider, useCurrentUser } from '@/contexts/UserContext';
import { CallProvider } from '@/contexts/CallContext';
import { notificationService } from '@/services/notificationService';
import Constants from 'expo-constants';

export const unstable_settings = {
  initialRouteName: 'index',
};

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

function RootLayoutNav() {
  const { theme } = useTheme();
  const { userData, firebaseUser } = useCurrentUser();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (firebaseUser?.uid) {
      import('@/utils/notifications').then(({ registerForPushNotifications }) => {
        registerForPushNotifications(firebaseUser.uid);
      });
      notificationService.init(firebaseUser.uid);
    }
  }, [firebaseUser?.uid]);

  useEffect(() => {
    notificationService.onNewNotification((n) => {
      const settings = userData?.settings;
      if (settings?.globalMute !== 'always') {
        const tone = settings?.globalTone || 'Predeterminado';
        import('@/utils/toneGenerator').then(({ previewTone }) => previewTone(tone));
      }
    });

    if (!IS_EXPO_GO) {
      const N = require('expo-notifications');

      notificationListener.current = N.addNotificationReceivedListener((_notification: any) => {});

      responseListener.current = N.addNotificationResponseReceivedListener((response: any) => {
        const { data } = response.notification.request.content;
        if (data?.channelId) {
          router.push(`/chat/${data.channelId}` as never);
        } else if (data?.participantId) {
          router.push(`/dm/${data.participantId}` as never);
        } else {
          router.push('/notifications' as never);
        }
      });
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      notificationService.onNewNotification(() => { });
    };
  }, [userData?.settings]);

  return (
    <NavigationThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <CallProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="dm/[userId]/call" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </CallProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <UserProvider>
          <RootLayoutNav />
        </UserProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}