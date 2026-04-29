import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { canAccessDiningVenuesManagement } from '@/lib/diningVenuesPermissions';

export default function StaffDiningVenuesLayout() {
  const { t } = useTranslation();
  const staff = useAuthStore((s) => s.staff);
  const isMgmt = canAccessDiningVenuesManagement(staff);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#1a1d21',
        headerBackTitle: t('back'),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: isMgmt ? t('diningVenuesAdminTitle') : t('diningVenuesNavTitle'),
        }}
      />
      <Stack.Screen name="guest/[id]" options={{ title: t('diningVenuesNavTitle') }} />
      <Stack.Screen name="venue/[id]" options={{ title: t('diningVenuesFormTitle') }} />
      <Stack.Screen name="pick-location" options={{ title: t('diningVenuesPickOnMap') }} />
    </Stack>
  );
}
