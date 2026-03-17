import { Stack } from 'expo-router';

export default function StaffExpensesLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Harcama geçmişim' }} />
      <Stack.Screen name="new" options={{ title: 'Yeni harcama girişi' }} />
    </Stack>
  );
}
