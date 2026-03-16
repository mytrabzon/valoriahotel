import { View, Text, StyleSheet } from 'react-native';

export default function StaffPermissionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Personel yetkileri ekranı burada olacak.</Text>
      <Text style={styles.hint}>Hangi personel hangi kapıyı hangi saat/gün açabilir (örn. temizlik 10:00–16:00).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f7fafc' },
  placeholder: { fontSize: 16, color: '#4a5568' },
  hint: { fontSize: 14, color: '#718096', marginTop: 8 },
});
