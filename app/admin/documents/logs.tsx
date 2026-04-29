import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { adminTheme } from '@/constants/adminTheme';
import { supabase } from '@/lib/supabase';

export default function AdminDocumentsLogs() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await supabase
      .from('document_logs')
      .select('id, document_id, actor_staff_id, action_type, created_at')
      .order('created_at', { ascending: false })
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
        ListEmptyComponent={<Text style={styles.sub}>{loading ? 'Yükleniyor…' : 'Log yok'}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.action_type}</Text>
            <Text style={styles.rowMeta}>
              {new Date(item.created_at).toLocaleString('tr-TR')} · doc: {String(item.document_id ?? '-').slice(0, 8)}
            </Text>
          </View>
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
  rowTitle: { fontSize: 14, fontWeight: '900', color: adminTheme.colors.text },
  rowMeta: { marginTop: 4, fontSize: 12, fontWeight: '600', color: adminTheme.colors.textMuted },
});

