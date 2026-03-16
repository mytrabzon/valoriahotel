import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function StaffHomeScreen() {
  const router = useRouter();
  const { staff } = useAuthStore();
  const name = staff?.full_name?.split(' ')[0] ?? 'Personel';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.welcome}>Hoş geldiniz, {name}!</Text>
      <Text style={styles.subtitle}>Hızlı işlemler</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/staff/stock/entry')}>
          <Text style={styles.quickBtnIcon}>📦</Text>
          <Text style={styles.quickBtnText}>Stok Girişi</Text>
          <Text style={styles.quickBtnHint}>Barkod okut veya ürün seç</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.quickBtnIcon}>👤</Text>
          <Text style={styles.quickBtnText}>Profilim</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/notifications')}>
          <Text style={styles.quickBtnIcon}>🔔</Text>
          <Text style={styles.quickBtnText}>Bildirimler</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 20, paddingBottom: 40 },
  welcome: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  quickBtn: { padding: 16, borderRadius: 10 },
  quickBtnIcon: { fontSize: 28, marginBottom: 8 },
  quickBtnText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  quickBtnHint: { fontSize: 13, color: '#6b7280', marginTop: 2 },
});
