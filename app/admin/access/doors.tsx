import { View, Text, StyleSheet } from 'react-native';

export default function AccessDoorsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Kapı listesi ve yönetimi burada olacak.</Text>
      <Text style={styles.hint}>Oda kapıları (101–118), otopark, havuz, spor salonu, personel girişi ekle/düzenle.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f7fafc' },
  placeholder: { fontSize: 16, color: '#4a5568' },
  hint: { fontSize: 14, color: '#718096', marginTop: 8 },
});
