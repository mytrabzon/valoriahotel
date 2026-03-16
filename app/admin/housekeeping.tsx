import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'out_of_order';

type Room = {
  id: string;
  room_number: string;
  floor: number | null;
  status: RoomStatus;
};

const STATUS_LABELS: Record<RoomStatus, string> = {
  available: 'Müsait',
  occupied: 'Dolu',
  cleaning: 'Temizlikte',
  maintenance: 'Bakımda',
  out_of_order: 'Kullanılmıyor',
};

const STATUS_STYLES: Record<RoomStatus, { borderColor: string; backgroundColor: string }> = {
  available: { borderColor: '#48bb78', backgroundColor: '#f0fff4' },
  occupied: { borderColor: '#ed8936', backgroundColor: '#fffaf0' },
  cleaning: { borderColor: '#4299e1', backgroundColor: '#ebf8ff' },
  maintenance: { borderColor: '#e53e3e', backgroundColor: '#fff5f5' },
  out_of_order: { borderColor: '#718096', backgroundColor: '#f7fafc' },
};

const STATUS_OPTIONS: RoomStatus[] = ['available', 'occupied', 'cleaning', 'maintenance', 'out_of_order'];

export default function HousekeepingScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RoomStatus | 'all'>('all');

  const loadRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id, room_number, floor, status')
      .order('floor', { ascending: true, nullsFirst: false })
      .order('room_number');
    setRooms((data as Room[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const updateStatus = async (roomId: string, newStatus: RoomStatus) => {
    const { error } = await supabase.from('rooms').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', roomId);
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, status: newStatus } : r)));
  };

  const showStatusMenu = (room: Room) => {
    Alert.alert(
      `Oda ${room.room_number} – Durum`,
      'Yeni durum seçin:',
      STATUS_OPTIONS.map((s) => ({
        text: STATUS_LABELS[s],
        onPress: () => updateStatus(room.id, s),
      })).concat([{ text: 'İptal', style: 'cancel' }])
    );
  };

  const filtered = filter === 'all' ? rooms : rooms.filter((r) => r.status === filter);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loading}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Oda Durumu (Housekeeping)</Text>
      <View style={styles.filterRow}>
        {(['all', ...STATUS_OPTIONS] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'Tümü' : STATUS_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, STATUS_STYLES[item.status]]}
            onPress={() => showStatusMenu(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.roomNumber}>Oda {item.room_number}</Text>
            {item.floor != null && <Text style={styles.floor}>Kat {item.floor}</Text>}
            <Text style={styles.statusLabel}>{STATUS_LABELS[item.status]}</Text>
            <Text style={styles.tapHint}>Dokun → durum değiştir</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loading: { color: '#718096', fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a202c', padding: 24, paddingBottom: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  filterChipActive: { backgroundColor: '#1a365d' },
  filterChipText: { fontSize: 13, color: '#4a5568', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 48 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  roomNumber: { fontSize: 17, fontWeight: '700', color: '#1a202c' },
  floor: { fontSize: 12, color: '#718096', marginTop: 2 },
  statusLabel: { fontSize: 14, fontWeight: '600', color: '#2d3748', marginTop: 8 },
  tapHint: { fontSize: 11, color: '#a0aec0', marginTop: 4 },
});
