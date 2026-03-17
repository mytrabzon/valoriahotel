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
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type Door = {
  id: string;
  name: string;
  door_type: string;
  room_id: string | null;
  sort_order: number;
  is_active: boolean;
  rooms: { room_number: string } | null;
};

const DOOR_TYPE_LABELS: Record<string, string> = {
  room: 'Oda',
  parking: 'Otopark',
  pool: 'Havuz',
  gym: 'Spor',
  staff: 'Personel',
  storage: 'Depo',
  other: 'Diğer',
};

export default function AccessDoorsScreen() {
  const router = useRouter();
  const [doors, setDoors] = useState<Door[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('doors')
      .select('id, name, door_type, room_id, sort_order, is_active, rooms(room_number)')
      .order('sort_order', { ascending: true })
      .order('name');
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    setDoors((data as Door[]) ?? []);
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

  const toggleActive = async (door: Door) => {
    setTogglingId(door.id);
    const { error } = await supabase
      .from('doors')
      .update({ is_active: !door.is_active, updated_at: new Date().toISOString() })
      .eq('id', door.id);
    setTogglingId(null);
    if (error) Alert.alert('Hata', error.message);
    else await load();
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
      <Link href="/admin/access/doors/new" asChild>
        <TouchableOpacity style={styles.addBtn}>
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.addBtnText}>Yeni kapı</Text>
        </TouchableOpacity>
      </Link>
      <FlatList
        data={doors}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a365d']} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.is_active && styles.cardInactive]}
            onPress={() => router.push(`/admin/access/doors/${item.id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardMain}>
                <Text style={styles.cardName}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.badge, { backgroundColor: item.door_type === 'room' ? '#3182ce' : '#718096' }]}>
                    <Text style={styles.badgeText}>{DOOR_TYPE_LABELS[item.door_type] ?? item.door_type}</Text>
                  </View>
                  {item.rooms?.room_number && (
                    <Text style={styles.roomMeta}>Oda no: {item.rooms.room_number}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={() => toggleActive(item)}
                disabled={togglingId === item.id}
              >
                {togglingId === item.id ? (
                  <ActivityIndicator size="small" color="#1a365d" />
                ) : (
                  <Ionicons
                    name={item.is_active ? 'checkmark-circle' : 'close-circle-outline'}
                    size={28}
                    color={item.is_active ? '#38a169' : '#a0aec0'}
                  />
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Henüz kapı tanımlı değil.</Text>
            <Text style={styles.emptyHint}>Oda kapıları ve ortak alanlar (otopark, havuz, personel) ekleyin.</Text>
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
  cardInactive: { opacity: 0.7, borderColor: '#cbd5e0' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMain: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '700', color: '#1a202c' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  roomMeta: { fontSize: 13, color: '#718096' },
  toggleBtn: { padding: 8 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#4a5568' },
  emptyHint: { fontSize: 14, color: '#718096', marginTop: 8, textAlign: 'center' },
});
