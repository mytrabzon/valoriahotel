import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

type Application = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  applied_department: string;
  experience: string | null;
  created_at: string;
};

const DEPT_LABELS: Record<string, string> = {
  housekeeping: 'Temizlik',
  technical: 'Teknik',
  receptionist: 'Resepsiyon',
  security: 'Güvenlik',
  other: 'Diğer',
};

export default function PendingStaffScreen() {
  const router = useRouter();
  const { staff } = useAuthStore();
  const [list, setList] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchPending = async () => {
    setErrorMsg(null);
    const { data, error } = await supabase
      .from('staff_applications')
      .select('id, full_name, email, phone, applied_department, experience, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) {
      setErrorMsg(error.message || 'Liste yüklenemedi.');
      setList([]);
      return;
    }
    setList((data as Application[]) ?? []);
  };

  useEffect(() => {
    fetchPending().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPending();
    setRefreshing(false);
  };

  const reject = (app: Application) => {
    Alert.alert('Başvuruyu reddet', `${app.full_name} başvurusunu reddetmek istediğinize emin misiniz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Reddet',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('staff_applications')
            .update({
              status: 'rejected',
              reviewed_by: staff?.id ?? null,
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', app.id);
          fetchPending();
        },
      },
    ]);
  };

  const timeStr = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a365d" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a365d']} />
      }
    >
      <Text style={styles.title}>Onay bekleyen çalışan başvuruları</Text>
      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPending()}>
            <Text style={styles.retryBtnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : list.length === 0 ? (
        <Text style={styles.empty}>Bekleyen başvuru yok.</Text>
      ) : (
        list.map((app) => (
          <View key={app.id} style={styles.card}>
            <Text style={styles.cardName}>👤 {app.full_name}</Text>
            <Text style={styles.cardMeta}>📧 {app.email}</Text>
            {app.phone ? <Text style={styles.cardMeta}>📞 {app.phone}</Text> : null}
            <Text style={styles.cardMeta}>
              🏢 Başvuru: {DEPT_LABELS[app.applied_department] ?? app.applied_department}
            </Text>
            {app.experience ? (
              <Text style={styles.cardExp} numberOfLines={2}>
                📝 {app.experience}
              </Text>
            ) : null}
            <Text style={styles.cardTime}>⏰ Başvuru: {timeStr(app.created_at)}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.btnEdit}
                onPress={() => router.push({ pathname: '/admin/staff/approve/[id]', params: { id: app.id } })}
              >
                <Text style={styles.btnEditText}>✏️ Düzenle / Onayla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnApprove} onPress={() => router.push({ pathname: '/admin/staff/approve/[id]', params: { id: app.id } })}>
                <Text style={styles.btnApproveText}>✅ Onayla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnReject} onPress={() => reject(app)}>
                <Text style={styles.btnRejectText}>❌ Reddet</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#1a202c', marginBottom: 16 },
  empty: { fontSize: 15, color: '#718096' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardName: { fontSize: 17, fontWeight: '700', color: '#1a202c' },
  cardMeta: { fontSize: 14, color: '#4a5568', marginTop: 4 },
  cardExp: { fontSize: 13, color: '#718096', marginTop: 6, fontStyle: 'italic' },
  cardTime: { fontSize: 12, color: '#a0aec0', marginTop: 6 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btnEdit: { backgroundColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnEditText: { fontSize: 13, fontWeight: '600', color: '#4a5568' },
  btnApprove: { backgroundColor: '#48bb78', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnApproveText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  btnReject: { backgroundColor: '#fc8181', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnRejectText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  errorBox: { backgroundColor: '#fff5f5', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#feb2b2' },
  errorText: { fontSize: 14, color: '#c53030', marginBottom: 12 },
  retryBtn: { backgroundColor: '#1a365d', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
