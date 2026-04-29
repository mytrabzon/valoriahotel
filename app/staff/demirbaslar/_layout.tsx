import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function StaffFixedAssetsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#1a1d21' }}>
      <Stack.Screen name="index" options={{ title: t('staffAssetsTitle') }} />
      <Stack.Screen name="new" options={{ title: t('staffAssetsNewTitle') }} />
      <Stack.Screen name="[id]" options={{ title: t('staffAssetsDetailTitle') }} />
    </Stack>
  );
}
