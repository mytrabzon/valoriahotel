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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type LogRow = {
  id: string;
  door_id: string;
  card_id: string | null;
  staff_id: string | null;
  serial_used: string | null;
  result: 'granted' | 'denied';
  denial_reason: string | null;
  created_at: string;
  doors: { name: string } | null;
  access_cards: { serial_number: string } | null;
  staff: { full_name: string | null } | null;
};

type DoorRow = { id: string; name: string };

export default function AccessLogsScreen() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [doors, setDoors] = useState<DoorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterDoorId, setFilterDoorId] = useState<string | null>(null);
  const [filterResult, setFilterResult] = useState<'all' | 'granted' | 'denied'>('all');

  const loadDoors = useCallback(() => {
    supabase.from('doors').select('id, name').eq('is_active', true).order('name').then(({ data }) => setDoors(data ?? []));
  }, []);

  const load = useCallback(async () => {
    let q = supabase
      .from('door_access_logs')
      .select('id, door_id, card_id, staff_id, serial_used, result, denial_reason, created_at, doors(name), access_cards(serial_number), staff(full_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filterDoorId) q = q.eq('door_id', filterDoorId);
    if (filterResult !== 'all') q = q.eq('result', filterResult);
    const { data, error } = await q;
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    setLogs((data as LogRow[]) ?? []);
  }, [filterDoorId, filterResult]);

  useEffect(() => {
    loadDoors();
  }, [loadDoors]);

  useEffect(() => {
    load();
    setLoading(false);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const who = (row: LogRow) => {
    if (row.staff?.full_name) return row.staff.full_name;
    if (row.access_cards?.serial_number) return row.access_cards.serial_number;
    return row.serial_used ?? '—';
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
      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Kapı</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, !filterDoorId && styles.chipActive]}
            onPress={() => setFilterDoorId(null)}
          >
            <Text style={[styles.chipText, !filterDoorId && styles.chipTextActive]}>Tümü</Text>
          </TouchableOpacity>
          {doors.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.chip, filterDoorId === d.id && styles.chipActive]}
              onPress={() => setFilterDoorId(filterDoorId === d.id ? null : d.id)}
            >
              <Text style={[styles.chipText, filterDoorId === d.id && styles.chipTextActive]} numberOfLines={1}>
                {d.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.filterLabel}>Sonuç</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, filterResult === 'all' && styles.chipActive]}
            onPress={() => setFilterResult('all')}
          >
            <Text style={[styles.chipText, filterResult === 'all' && styles.chipTextActive]}>Tümü</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, filterResult === 'granted' && styles.chipActive]}
            onPress={() => setFilterResult('granted')}
          >
            <Text style={[styles.chipText, filterResult === 'granted' && styles.chipTextActive]}>Açıldı</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, filterResult === 'denied' && styles.chipActive]}
            onPress={() => setFilterResult('denied')}
          >
            <Text style={[styles.chipText, filterResult === 'denied' && styles.chipTextActive]}>Reddedildi</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={logs}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a365d']} />}
        renderItem={({ item }) => (
          <View style={[styles.card, item.result === 'denied' && styles.cardDenied]}>
            <View style={styles.cardRow}>
              <View style={[styles.resultBadge, item.result === 'granted' ? styles.badgeGranted : styles.badgeDenied]}>
                <Ionicons name={item.result === 'granted' ? 'checkmark-circle' : 'close-circle'} size={18} color="#fff" />
                <Text style={styles.resultText}>{item.result === 'granted' ? 'Açıldı' : 'Reddedildi'}</Text>
              </View>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString('tr-TR')}</Text>
            </View>
            <Text style={styles.doorName}>{item.doors?.name ?? '—'}</Text>
            <Text style={styles.who}>{who(item)}</Text>
            {item.denial_reason ? <Text style={styles.denial}>Sebep: {item.denial_reason}</Text> : null}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Kayıt yok.</Text>
            <Text style={styles.emptyHint}>Kapı okuyuculardan gelen geçiş kayıtları burada listelenir.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7fafc' },
  filters: { padding: 16, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#718096', marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#edf2f7',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#1a365d', borderColor: '#1a365d' },
  chipText: { fontSize: 13, color: '#4a5568' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#38a169',
  },
  cardDenied: { borderLeftColor: '#e53e3e' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeGranted: { backgroundColor: '#38a169' },
  badgeDenied: { backgroundColor: '#e53e3e' },
  resultText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  date: { fontSize: 12, color: '#718096' },
  doorName: { fontSize: 16, fontWeight: '600', color: '#1a202c', marginTop: 8 },
  who: { fontSize: 14, color: '#4a5568', marginTop: 4 },
  denial: { fontSize: 13, color: '#e53e3e', marginTop: 4, fontStyle: 'italic' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#4a5568' },
  emptyHint: { fontSize: 14, color: '#718096', marginTop: 8, textAlign: 'center' },
});
