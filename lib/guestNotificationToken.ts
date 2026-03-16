import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'valoria_guest_notification_token';

export async function getGuestNotificationToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function setGuestNotificationToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEY, token);
}

export async function clearGuestNotificationToken(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
