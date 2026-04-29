import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { adminTheme } from '@/constants/adminTheme';

/**
 * Karbon alt rotaları tek grupta; üst admin Stack'te yalnızca `carbon` kaydı olur (Unmatched önlemi).
 */
export default function AdminCarbonLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: adminTheme.colors.text,
        headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
        headerShadowVisible: true,
        ...(Platform.OS === 'android' && { statusBarColor: '#fff' }),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Karbon ayak izi' }} />
      <Stack.Screen name="report" options={{ title: 'Karbon raporu' }} />
    </Stack>
  );
}
