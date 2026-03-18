import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

const GUEST_BG = '#1a365d';

export default function GuestLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.body.style.backgroundColor = GUEST_BG;
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="language" />
      <Stack.Screen name="contract" />
      <Stack.Screen name="form" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="sign" />
      <Stack.Screen name="sign-one" />
      <Stack.Screen name="success" />
    </Stack>
  );
}
