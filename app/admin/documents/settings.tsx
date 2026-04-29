import { View, Text, StyleSheet } from 'react-native';
import { adminTheme } from '@/constants/adminTheme';

export default function AdminDocumentsSettings() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doküman Yönetimi Ayarları</Text>
      <Text style={styles.sub}>Bu ekranı dosya türleri, onay kuralları ve bildirim kanalları için kullanacağız.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary, padding: 20 },
  title: { fontSize: 18, fontWeight: '800', color: adminTheme.colors.text },
  sub: { marginTop: 8, fontSize: 13, fontWeight: '600', color: adminTheme.colors.textMuted, lineHeight: 18 },
});

