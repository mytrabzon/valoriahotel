import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="code" />
      <Stack.Screen name="password" />
      <Stack.Screen name="reset" />
      <Stack.Screen name="callback" />
      <Stack.Screen name="set-password" />
    </Stack>
  );
}
