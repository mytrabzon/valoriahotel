import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="staff/[id]" options={{ headerShown: true, title: 'Çalışan' }} />
      <Stack.Screen name="hotel/index" options={{ headerShown: true, title: 'Otel' }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Sohbet' }} />
      <Stack.Screen name="new-chat" options={{ headerShown: true, title: 'Yeni Sohbet' }} />
    </Stack>
  );
}
