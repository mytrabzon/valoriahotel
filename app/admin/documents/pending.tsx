import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminTheme } from '@/constants/adminTheme';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

export default function AdminDocumentsPending() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await supabase
      .from('document_approvals')
      .select('id, document_id, status, created_at, requested_by_staff_id, documents(title, status)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!res.error && res.data) setRows(res.data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (approvalId: string, documentId: string) => {
    const now = new Date().toISOString();
    // document update + approval update (admin RLS required)
    const docUp = await supabase.from('documents').update({ status: 'active', approved_by_staff_id: null, rejected_reason: null }).eq('id', documentId);
    if (docUp.error) {
      Alert.alert('Hata', docUp.error.message);
      return;
    }
    const apprUp = await supabase.from('document_approvals').update({ status: 'approved', reviewed_at: now }).eq('id', approvalId);
    if (apprUp.error) {
      Alert.alert('Hata', apprUp.error.message);
      return;
    }
    await load();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Text style={styles.sub}>{loading ? 'Yükleniyor…' : 'Onay bekleyen belge yok'}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity style={{ flex: 1, minWidth: 0 }} activeOpacity={0.75} onPress={() => router.push(`/admin/documents/${item.document_id}` as never)}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.documents?.title ?? 'Belge'}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                Talep: {new Date(item.created_at).toLocaleString('tr-TR')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item.id, item.document_id)} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: adminTheme.colors.surface,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 15, fontWeight: '800', color: adminTheme.colors.text },
  rowMeta: { marginTop: 4, fontSize: 12, fontWeight: '600', color: adminTheme.colors.textMuted },
  approveBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: adminTheme.colors.success, alignItems: 'center', justifyContent: 'center' },
});

