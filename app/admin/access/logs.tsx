import { View, Text, StyleSheet } from 'react-native';

export default function AccessLogsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Kapı açılma logları burada olacak.</Text>
      <Text style={styles.hint}>Saat, kapı, kart/misafir/personel, sonuç (açıldı / yetkisiz). Rapor, Excel/PDF.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f7fafc' },
  placeholder: { fontSize: 16, color: '#4a5568' },
  hint: { fontSize: 14, color: '#718096', marginTop: 8 },
});
