/**
 * Valoria Hotel - Expo Push Notifications
 * Token alma, backend'e kaydetme, bildirim tıklama yönlendirmesi.
 */
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logger';

const EXPO_PUSH_TOKEN_KEY = 'valoria_expo_push_token';

/** Uygulama açıkken gelen bildirimi nasıl göstereceğiz */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** İzin iste, Expo push token al; yoksa null (web veya izin reddi). */
export async function getExpoPushTokenAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') {
      log.warn('notificationsPush', 'Push izni verilmedi');
      return null;
    }
    const projectId = (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas?.projectId;
    if (!projectId) {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData?.data ?? null;
      if (token) await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, token);
      return token;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data ?? null;
    if (token) await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, token);
    return token;
  } catch (e) {
    log.error('notificationsPush', 'getExpoPushTokenAsync', e);
    return null;
  }
}

/** Cihazda kayıtlı Expo push token */
export async function getStoredExpoPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);
}

/** Personel giriş yaptığında: push token'ı backend'e kaydet (push_tokens.staff_id). */
export async function savePushTokenForStaff(staffId: string): Promise<void> {
  const token = await getStoredExpoPushToken();
  if (!token) return;
  try {
    await supabase.from('push_tokens').upsert(
      {
        token,
        staff_id: staffId,
        guest_id: null,
        device_info: { platform: Platform.OS },
      },
      { onConflict: 'token' }
    );
    log.info('notificationsPush', 'Staff push token kaydedildi', { staffId: staffId.slice(0, 8) });
  } catch (e) {
    log.error('notificationsPush', 'savePushTokenForStaff', e);
  }
}

/** Misafir app_token ile: push token'ı backend'e kaydet (RPC ile push_tokens.guest_id). */
export async function savePushTokenForGuest(appToken: string): Promise<void> {
  const token = await getStoredExpoPushToken();
  if (!token || !appToken) return;
  try {
    const { error } = await supabase.rpc('upsert_guest_push_token', {
      p_app_token: appToken,
      p_token: token,
    });
    if (error) log.error('notificationsPush', 'savePushTokenForGuest RPC', error);
    else log.info('notificationsPush', 'Guest push token kaydedildi');
  } catch (e) {
    log.error('notificationsPush', 'savePushTokenForGuest', e);
  }
}

/** Bildirime tıklandığında çağrılacak (root layout'ta listener ile bağlanır). */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}
