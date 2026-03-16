import { View, Text, StyleSheet } from 'react-native';

export default function AccessCardsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Kart tanımlama ekranı burada olacak.</Text>
      <Text style={styles.hint}>Kart okut → seri no otomatik, oda/personel seç, geçerlilik tarihi, açılacak kapılar.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f7fafc' },
  placeholder: { fontSize: 16, color: '#4a5568' },
  hint: { fontSize: 14, color: '#718096', marginTop: 8 },
});
