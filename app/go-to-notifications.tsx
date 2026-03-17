/**
 * Bildirimlere yönlendirme sayfası.
 * Push bildirime tıklanınca bu route açılır, hemen staff/customer bildirimler sekmesine replace edilir.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function GoToNotificationsScreen() {
  const router = useRouter();
  const staff = useAuthStore((s) => s.staff);

  useEffect(() => {
    const target = staff ? '/staff/notifications' : '/customer/notifications';
    router.replace(target as never);
    if (!staff) {
      import('@/stores/guestNotificationStore').then(({ useGuestNotificationStore }) =>
        useGuestNotificationStore.getState().refresh()
      );
    }
  }, [router, staff]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#1a365d" />
    </View>
  );
}
