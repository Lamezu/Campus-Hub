import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

// expo-notifications triggers a push-token auto-registration side effect on import.
// In Expo Go (SDK 53+) that throws; never require the module there.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

if (!IS_EXPO_GO) {
  const N = require('expo-notifications');
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (IS_EXPO_GO || !Device.isDevice) return null;

  const N = require('expo-notifications');

  const { status: existingStatus } = await N.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await N.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  let token: string | null = null;
  try {
    const deviceToken = await N.getDevicePushTokenAsync();
    token = deviceToken.data;
  } catch (error) {
    console.error('Error getting push token:', error);
  }

  if (token) {
    await updateDoc(doc(db, 'users', userId), {
      fcmToken: token,
      notificationsEnabled: true,
      lastTokenUpdate: serverTimestamp(),
    });
  }

  if (Platform.OS === 'android') {
    N.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: N.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });

    N.setNotificationChannelAsync('calls', {
      name: 'Calls',
      importance: N.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500],
      lightColor: '#FF0000',
      sound: 'default',
    });
  }

  return token;
}

export async function sendPushNotification(expoPushToken: string, title: string, body: string, data: any = {}) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}
