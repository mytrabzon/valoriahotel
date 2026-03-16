import { Stack } from 'expo-router';

export default function StaffStockLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: '#b8860b' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="entry" options={{ title: 'Stok Girişi' }} />
      <Stack.Screen name="scan" options={{ title: 'Barkod Okut', headerShown: false }} />
    </Stack>
  );
}
