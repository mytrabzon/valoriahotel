import { Stack } from 'expo-router';
import { theme } from '@/constants/theme';
import { useTranslation } from 'react-i18next';

export default function StaffSalesLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
        headerTintColor: theme.colors.primary,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('adminSalesAndCommission') }} />
      <Stack.Screen name="new" options={{ title: t('adminNewSale') }} />
      <Stack.Screen name="[id]" options={{ title: t('adminSaleDetail') }} />
    </Stack>
  );
}

