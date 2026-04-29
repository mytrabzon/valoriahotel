import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { canAccessTransferTourManagement } from '@/lib/transferTourPermissions';

export default function StaffTransferTourLayout() {
  const { t } = useTranslation();
  const staff = useAuthStore((s) => s.staff);
  const isMgmt = canAccessTransferTourManagement(staff);
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
          title: isMgmt ? t('transferTourAdminMenu') : t('transferTourNavTitle'),
        }}
      />
      <Stack.Screen name="guest/[id]" options={{ title: t('transferTourNavTitle') }} />
      <Stack.Screen name="pick-location" options={{ title: t('transferTourPickLocation') }} />
      <Stack.Screen name="service/[id]" options={{ title: t('transferTourEditService') }} />
    </Stack>
  );
}
