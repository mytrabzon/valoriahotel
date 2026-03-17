import { TouchableOpacity, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { theme } from '@/constants/theme';

function ProfileBackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.replace('/customer/profile')} style={{ marginLeft: 8 }} activeOpacity={0.7}>
      <Text style={{ fontSize: 17, color: theme.colors.primary }}>Geri</Text>
    </TouchableOpacity>
  );
}

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Geri',
        headerTitleStyle: { fontSize: 17, fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="edit"
        options={{
          title: 'Profil bilgilerini düzenle',
          headerBackTitle: 'Geri',
          headerLeft: () => <ProfileBackButton />,
        }}
      />
      <Stack.Screen
        name="delete-account"
        options={{
          title: 'Hesabımı sil',
          headerBackTitle: 'Geri',
          headerLeft: () => <ProfileBackButton />,
        }}
      />
    </Stack>
  );
}
