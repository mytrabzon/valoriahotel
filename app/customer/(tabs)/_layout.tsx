import { Tabs } from 'expo-router';

export default function CustomerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#b8860b',
        tabBarInactiveTintColor: '#666',
        headerStyle: { backgroundColor: '#b8860b' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa', headerTitle: 'Valoria Hotel' }} />
      <Tabs.Screen name="messages" options={{ title: 'Mesajlar' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Bildirimler' }} />
      <Tabs.Screen name="rooms" options={{ title: 'Odalar' }} />
      <Tabs.Screen name="key" options={{ title: 'Dijital Anahtar' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
