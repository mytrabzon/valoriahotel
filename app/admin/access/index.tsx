import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';

export default function AccessControlDashboard() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Geçiş Kontrol Sistemi</Text>
      <Text style={styles.subtitle}>Kapılar, kartlar ve personel yetkilerini buradan yönetin.</Text>

      <Link href="/admin/access/doors" asChild>
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>Kapılar</Text>
          <Text style={styles.cardDesc}>Oda kapıları, otopark, havuz, spor salonu, personel girişi ekle/düzenle</Text>
        </TouchableOpacity>
      </Link>
      <Link href="/admin/access/cards" asChild>
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>Kart Tanımlama</Text>
          <Text style={styles.cardDesc}>Misafir/personel kartı tanımla, geçerlilik tarihi, hangi kapılar</Text>
        </TouchableOpacity>
      </Link>
      <Link href="/admin/access/staff-permissions" asChild>
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>Personel Yetkileri</Text>
          <Text style={styles.cardDesc}>Kim hangi kapıyı hangi saatte açabilir</Text>
        </TouchableOpacity>
      </Link>
      <Link href="/admin/access/logs" asChild>
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>Kapı Logları</Text>
          <Text style={styles.cardDesc}>Kim ne zaman hangi kapıyı açtı, yetkisiz denemeler</Text>
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a202c', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#718096', marginBottom: 24 },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1a202c' },
  cardDesc: { fontSize: 14, color: '#718096', marginTop: 4 },
});
