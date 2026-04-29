import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { adminTheme } from '@/constants/adminTheme';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AdminDocumentsExpiring() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const res = await supabase
      .from('documents')
      .select('id, title, expiry_date, status, updated_at')
      .not('expiry_date', 'is', null)
      .gte('expiry_date', today.toISOString().slice(0, 10))
      .lte('expiry_date', in30.toISOString().slice(0, 10))
      .order('expiry_date', { ascending: true })
      .limit(200);
    if (!res.error && res.data) setRows(res.data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Text style={styles.sub}>{loading ? 'Yükleniyor…' : 'Kayıt yok'}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} activeOpacity={0.75} onPress={() => router.push(`/admin/documents/${item.id}` as never)}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.rowMeta}>Son geçerlilik: {item.expiry_date}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  content: { padding: 20, paddingBottom: 24 },
  sub: { fontSize: 13, fontWeight: '600', color: adminTheme.colors.textMuted, lineHeight: 18 },
  row: { backgroundColor: adminTheme.colors.surface, borderRadius: adminTheme.radius.lg, borderWidth: 1, borderColor: adminTheme.colors.border, padding: 14, marginBottom: 10 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: adminTheme.colors.text },
  rowMeta: { marginTop: 4, fontSize: 12, fontWeight: '600', color: adminTheme.colors.textMuted },
});

