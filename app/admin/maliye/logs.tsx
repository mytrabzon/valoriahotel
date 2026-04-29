import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { listMaliyeLogs } from '@/lib/maliyeAccess';

type LogRow = {
  id: string;
  event_type: string;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export default function AdminMaliyeLogs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listMaliyeLogs(300);
    if (!res.error) setRows((res.data as LogRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.event_type}</Text>
            <Text style={styles.meta}>Durum: {item.success ? 'Başarılı' : 'Hatalı'}</Text>
            <Text style={styles.meta}>IP: {item.ip_address ?? '-'}</Text>
            <Text style={styles.meta} numberOfLines={1}>UA: {item.user_agent ?? '-'}</Text>
            <Text style={styles.meta}>{new Date(item.created_at).toLocaleString('tr-TR')}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 14 },
  card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 8 },
  title: { fontWeight: '800', color: '#0f172a' },
  meta: { color: '#64748b', marginTop: 2, fontSize: 12 },
});
