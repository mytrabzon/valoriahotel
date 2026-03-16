import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

type NotifRow = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  read_at: string | null;
  created_at: string;
};

export default function StaffNotificationsScreen() {
  const { staff } = useAuthStore();
  const [list, setList] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!staff?.id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, category, read_at, created_at')
      .eq('staff_id', staff.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setList((data as NotifRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [staff?.id]);

  const markRead = async (id: string) => {
    if (!staff?.id) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('staff_id', staff.id);
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  const categoryLabel = (c: string | null) => {
    const m: Record<string, string> = {
      emergency: 'Acil',
      guest: 'Misafir',
      staff: 'Görev',
      admin: 'Admin',
      bulk: 'Duyuru',
    };
    return c ? m[c] ?? c : '';
  };

  if (!staff) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Oturum gerekli.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>Bildirimlerim</Text>
      <Text style={styles.subtitle}>Yeni görevler, acil durumlar ve duyurular burada.</Text>
      {list.length === 0 && !loading ? (
        <Text style={styles.empty}>Henüz bildirim yok.</Text>
      ) : (
        list.map((n) => (
          <TouchableOpacity
            key={n.id}
            style={[styles.row, n.read_at ? styles.rowRead : null]}
            onPress={() => !n.read_at && markRead(n.id)}
            activeOpacity={0.8}
          >
            {categoryLabel(n.category) ? (
              <Text style={styles.rowCategory}>{categoryLabel(n.category)}</Text>
            ) : null}
            <Text style={styles.rowTitle}>{n.title}</Text>
            {n.body ? <Text style={styles.rowBody}>{n.body}</Text> : null}
            <Text style={styles.rowTime}>{new Date(n.created_at).toLocaleString('tr-TR')}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { fontSize: 16, color: '#718096' },
  title: { fontSize: 20, fontWeight: '700', color: '#1a202c', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#718096', marginBottom: 20 },
  empty: { color: '#a0aec0', fontSize: 14 },
  row: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowRead: { opacity: 0.85 },
  rowCategory: { fontSize: 12, color: '#b8860b', fontWeight: '600', marginBottom: 4 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#1a202c', marginBottom: 4 },
  rowBody: { fontSize: 14, color: '#4a5568', marginBottom: 8 },
  rowTime: { fontSize: 12, color: '#a0aec0' },
});
