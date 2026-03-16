import { useEffect } from 'react';
import { useRouter, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function StaffLayout() {
  const router = useRouter();
  const { staff, loading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!staff) {
      router.replace('/admin/login');
      return;
    }
  }, [loading, staff]);

  if (loading || !staff) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="stock" options={{ headerShown: false }} />
    </Stack>
  );
}
