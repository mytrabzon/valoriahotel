import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

type FormRow = { id: string; full_name: string | null; room_id: string | null; created_at: string };

export default function AdminMaliyeForms() {
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FormRow[]>([]);
  const [latest, setLatest] = useState<FormRow | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('guests').select('id, full_name, room_id, created_at').order('created_at', { ascending: false }).limit(300);
    if (date) q = q.gte('created_at', `${date}T00:00:00.000Z`).lte('created_at', `${date}T23:59:59.999Z`);
    else if (month) {
      const from = `${month}-01T00:00:00.000Z`;
      const d = new Date(from);
      d.setUTCMonth(d.getUTCMonth() + 1);
      q = q.gte('created_at', from).lt('created_at', d.toISOString());
    }
    const { data } = await q;
    setRows((data as FormRow[]) ?? []);
    setLatest(((data as FormRow[]) ?? [])[0] ?? null);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gunluk Musteri Formlari ve Denetim Kayitlari</Text>
      <View style={styles.filterRow}>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="Gun (YYYY-MM-DD)" />
        <TextInput style={styles.input} value={month} onChangeText={setMonth} placeholder="Ay (YYYY-MM)" />
        <TouchableOpacity style={styles.btn} onPress={load}><Text style={styles.btnText}>Kayitlari Getir</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}
      {latest ? <Text style={styles.latest}>Son form: {latest.full_name ?? 'Isimsiz'} · {new Date(latest.created_at).toLocaleString('tr-TR')}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.full_name ?? 'Isimsiz'}</Text>
            <Text style={styles.meta}>{new Date(item.created_at).toLocaleString('tr-TR')} · Oda: {item.room_id ?? '-'}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 14 },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  filterRow: { gap: 8, marginBottom: 10 },
  input: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', padding: 10 },
  btn: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 11, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  latest: { color: '#0f766e', marginBottom: 8, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 10, marginBottom: 8 },
  name: { fontWeight: '700', color: '#0f172a' },
  meta: { color: '#64748b', marginTop: 3 },
});
