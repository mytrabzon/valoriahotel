import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type PermRow = {
  id: string;
  staff_id: string;
  door_id: string;
  time_start: string | null;
  time_end: string | null;
  days_of_week: number[] | null;
  valid_from: string | null;
  valid_until: string | null;
  staff: { full_name: string | null; department: string | null } | null;
  doors: { name: string } | null;
};

const DAY_LABELS: Record<number, string> = { 1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt', 7: 'Paz' };

function formatTime(t: string | null) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  return `${h}:${m ?? '00'}`;
}

function formatDays(days: number[] | null) {
  if (!days?.length) return 'Her gün';
  return (days as number[]).sort((a, b) => a - b).map((d) => DAY_LABELS[d] ?? d).join(', ');
}

export default function StaffPermissionsScreen() {
  const router = useRouter();
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('staff_door_permissions')
      .select('id, staff_id, door_id, time_start, time_end, days_of_week, valid_from, valid_until, staff(full_name, department), doors(name)')
      .order('valid_from', { ascending: false });
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    setPerms((data as PermRow[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    setLoading(false);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const deletePerm = (p: PermRow) => {
    Alert.alert('Yetkiyi kaldır', `${p.staff?.full_name ?? 'Personel'} – ${p.doors?.name ?? 'Kapı'} yetkisini kaldırmak istiyor musunuz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('staff_door_permissions').delete().eq('id', p.id);
          if (error) Alert.alert('Hata', error.message);
          else await load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a365d" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/admin/access/staff-permissions/new')}>
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.addBtnText}>Yeni personel yetkisi</Text>
      </TouchableOpacity>
      <FlatList
        data={perms}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a365d']} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/admin/access/staff-permissions/${item.id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{item.staff?.full_name ?? '—'}</Text>
                <Text style={styles.doorName}>{item.doors?.name ?? '—'}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>
                    {formatTime(item.time_start)} – {formatTime(item.time_end)}
                  </Text>
                  <Text style={styles.days}>{formatDays(item.days_of_week)}</Text>
                </View>
                <Text style={styles.validity}>
                  {item.valid_from ? new Date(item.valid_from).toLocaleDateString('tr-TR') : '—'} –{' '}
                  {item.valid_until ? new Date(item.valid_until).toLocaleDateString('tr-TR') : 'Süresiz'}
                </Text>
              </View>
              <TouchableOpacity style={styles.delBtn} onPress={() => deletePerm(item)}>
                <Ionicons name="trash-outline" size={22} color="#e53e3e" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Henüz personel kapı yetkisi tanımlı değil.</Text>
            <Text style={styles.emptyHint}>Hangi personel hangi kapıyı hangi saat/gün açabilsin ekleyin.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7fafc' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 16,
    backgroundColor: '#1a365d',
    borderRadius: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  list: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1a202c' },
  doorName: { fontSize: 15, color: '#4a5568', marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  meta: { fontSize: 13, color: '#718096' },
  days: { fontSize: 13, color: '#718096' },
  validity: { fontSize: 12, color: '#a0aec0', marginTop: 4 },
  delBtn: { padding: 8 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#4a5568' },
  emptyHint: { fontSize: 14, color: '#718096', marginTop: 8, textAlign: 'center' },
});
