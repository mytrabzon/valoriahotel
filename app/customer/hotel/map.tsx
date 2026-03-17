import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

const FACILITIES = [
  { name: 'Resepsiyon', floor: 'Giriş', direction: 'Lobi, ana girişin karşısı', icon: '🛎️' },
  { name: 'Restoran', floor: '1. Kat', direction: 'Asansörle 1. kata, sağa', icon: '🍽️' },
  { name: 'Havuz', floor: 'Zemin', direction: 'Lobiden bahçe yönüne, 50 m', icon: '🏊' },
  { name: 'Spor salonu', floor: '-1. Kat', direction: 'Asansörle -1. kata', icon: '💪' },
  { name: 'Spa & Wellness', floor: '1. Kat', direction: 'Restoranın yanı', icon: '💆' },
  { name: 'Bar', floor: '1. Kat', direction: 'Restoran bitişiği', icon: '🍷' },
  { name: 'Otopark', floor: '-2. Kat', direction: 'Asansör veya rampa', icon: '🅿️' },
];

const EMERGENCY = [
  { label: 'Acil çıkış merdivenleri', desc: 'Her katta koridor sonlarında, işaretli kapılar.' },
  { label: 'Toplanma alanı', desc: 'Otelin ön bahçesi (lobi çıkışından sola).' },
  { label: 'Yangın söndürücü', desc: 'Koridorlarda ve lobide kırmızı dolaplar.' },
  { label: 'İlk yardım', desc: 'Resepsiyonda ilk yardım kiti ve eğitimli personel.' },
];

export default function HotelMapScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🗺️ Otel içi harita</Text>
      <Text style={styles.subtitle}>Nerede ne var? Oda numaranıza göre yön tarifi için resepsiyonla iletişime geçin.</Text>

      <Text style={styles.sectionTitle}>Tesisler</Text>
      {FACILITIES.map((f) => (
        <View key={f.name} style={styles.card}>
          <Text style={styles.cardIcon}>{f.icon}</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardName}>{f.name}</Text>
            <Text style={styles.cardFloor}>{f.floor}</Text>
            <Text style={styles.cardDir}>{f.direction}</Text>
          </View>
        </View>
      ))}

      <Text style={[styles.sectionTitle, styles.emergencySection]}>🚨 Acil çıkış yolları</Text>
      {EMERGENCY.map((e) => (
        <View key={e.label} style={styles.emergencyCard}>
          <Text style={styles.emergencyLabel}>{e.label}</Text>
          <Text style={styles.emergencyDesc}>{e.desc}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: 4 },
  subtitle: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginBottom: theme.spacing.xl },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  cardIcon: { fontSize: 28, marginRight: theme.spacing.md },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  cardFloor: { fontSize: 13, color: theme.colors.primary, marginTop: 2 },
  cardDir: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  emergencySection: { marginTop: theme.spacing.xl },
  emergencyCard: {
    backgroundColor: '#fef2f2',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
  },
  emergencyLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  emergencyDesc: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
});
