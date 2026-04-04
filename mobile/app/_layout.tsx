import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { UserProvider, useCurrentUser } from '@/contexts/UserContext';
import { CallProvider } from '@/contexts/CallContext';
import { AccountsProvider, useAccounts } from '@/contexts/AccountsContext';
import { notificationService } from '@/services/notificationService';
import { LanguageProvider } from '@/contexts/LanguageContext';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

if (!__DEV__) {
  console.log = () => { };
  console.warn = () => { };
  console.error = () => { };
}

export const unstable_settings = {
  initialRouteName: 'index',
};

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

function RootLayoutNav() {
  const { theme } = useTheme();
  const { userData, firebaseUser } = useCurrentUser();
  const { switching } = useAccounts();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      notificationService.stop();
      return;
    }
    import('@/utils/notifications').then(({ registerForPushNotifications }) => {
      registerForPushNotifications(firebaseUser.uid);
    });
    notificationService.init(firebaseUser.uid);
  }, [firebaseUser?.uid]);

  useEffect(() => {
    const { prewarmTones, previewTone } = require('@/utils/toneGenerator');
    prewarmTones();

    notificationService.onNewNotification((n) => {
      const settings = userData?.settings;
      if (settings?.globalMute !== 'always') {
        const tone = settings?.globalTone || 'Predeterminado';
        const toneKey = tone === 'Predeterminado' ? 'default' : tone.toLowerCase();
        previewTone(toneKey);
      }
    });

    if (!IS_EXPO_GO) {
      const N = require('expo-notifications');

      notificationListener.current = N.addNotificationReceivedListener((_notification: any) => { });

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
  }, [userData?.settings?.globalMute, userData?.settings?.globalTone]);

  const overlayBg = theme === 'dark' ? '#000' : '#fff';

  return (
    <NavigationThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <CallProvider>
        <Stack screenOptions={{ headerShown: false, headerBackTitle: '', headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="events/index" />
          <Stack.Screen name="dm/[userId]/call" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </CallProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {switching && (
        <View style={[styles.switchOverlay, { backgroundColor: overlayBg }]}>
          <ActivityIndicator size="large" color={theme === 'dark' ? '#fff' : '#000'} />
        </View>
      )}
    </NavigationThemeProvider>
  );
}

const styles = StyleSheet.create({
  switchOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
});

export default function RootLayout() {
  const [loaded, error] = Font.useFonts({
    ...FontAwesome.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <UserProvider>
          <AccountsProvider>
            <LanguageProvider>
              <RootLayoutNav />
            </LanguageProvider>
          </AccountsProvider>
        </UserProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}