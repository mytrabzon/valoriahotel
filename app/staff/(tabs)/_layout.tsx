import { Tabs } from 'expo-router';

export default function StaffTabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#b8860b', headerStyle: { backgroundColor: '#b8860b' }, headerTintColor: '#fff' }}>
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa', headerTitle: 'Personel' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profilim', headerTitle: 'Çalışan Profili' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Bildirimler', headerTitle: 'Bildirimlerim' }} />
    </Tabs>
  );
}
