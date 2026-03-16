import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AdminLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { staff, loading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[1] === 'login';
    if (!staff && !onLogin) router.replace('/admin/login');
  }, [loading, staff, segments]);

  return (
    <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: '#1a365d' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: 'Panel' }} />
      <Stack.Screen name="rooms/index" options={{ title: 'Odalar' }} />
      <Stack.Screen name="rooms/[id]" options={{ title: 'Oda Detay' }} />
      <Stack.Screen name="guests/index" options={{ title: 'Misafirler' }} />
      <Stack.Screen name="guests/[id]" options={{ title: 'Misafir Detay' }} />
      <Stack.Screen name="checkin" options={{ title: 'Check-in' }} />
      <Stack.Screen name="housekeeping" options={{ title: 'Oda Durumu' }} />
      <Stack.Screen name="report" options={{ title: 'Günlük Rapor' }} />
      <Stack.Screen name="contracts/index" options={{ title: 'Sözleşmeler' }} />
      <Stack.Screen name="contracts/rules" options={{ title: 'Kurallar Sözleşmesi (7 Dil)' }} />
      <Stack.Screen name="stock/index" options={{ title: 'Stok Yönetimi' }} />
      <Stack.Screen name="stock/movement" options={{ title: 'Stok Giriş/Çıkış' }} />
      <Stack.Screen name="stock/approvals" options={{ title: 'Onay Bekleyenler' }} />
      <Stack.Screen name="stock/scan" options={{ title: 'Barkod Okut', headerShown: false }} />
      <Stack.Screen name="access/index" options={{ title: 'Geçiş Kontrolü' }} />
      <Stack.Screen name="access/doors" options={{ title: 'Kapılar' }} />
      <Stack.Screen name="access/cards" options={{ title: 'Kart Tanımlama' }} />
      <Stack.Screen name="access/staff-permissions" options={{ title: 'Personel Yetkileri' }} />
      <Stack.Screen name="access/logs" options={{ title: 'Kapı Logları' }} />
      <Stack.Screen name="notifications/index" options={{ title: 'Bildirimler' }} />
      <Stack.Screen name="notifications/bulk" options={{ title: 'Toplu Bildirim' }} />
      <Stack.Screen name="notifications/templates" options={{ title: 'Bildirim Şablonları' }} />
      <Stack.Screen name="notifications/emergency" options={{ title: 'Acil Durum' }} />
      <Stack.Screen name="messages/index" options={{ title: 'Mesajlar' }} />
      <Stack.Screen name="messages/chat/[id]" options={{ title: 'Sohbet' }} />
      <Stack.Screen name="messages/new" options={{ title: 'Yeni Sohbet' }} />
      <Stack.Screen name="messages/bulk" options={{ title: 'Toplu Mesaj' }} />
    </Stack>
  );
}
