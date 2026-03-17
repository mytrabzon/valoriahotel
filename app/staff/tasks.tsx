import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';

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
  available: { borderColor: theme.colors.success, backgroundColor: theme.colors.success + '18' },
  occupied: { borderColor: '#ed8936', backgroundColor: '#fffaf0' },
  cleaning: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight + '20' },
  maintenance: { borderColor: theme.colors.error, backgroundColor: theme.colors.error + '18' },
  out_of_order: { borderColor: theme.colors.textMuted, backgroundColor: theme.colors.borderLight },
};

const STATUS_OPTIONS: RoomStatus[] = ['available', 'occupied', 'cleaning', 'maintenance', 'out_of_order'];

export default function StaffTasksScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<RoomStatus | 'all'>('all');

  const loadRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id, room_number, floor, status')
      .order('floor', { ascending: true, nullsFirst: false })
      .order('room_number');
    setRooms((data as Room[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadRooms();
  };

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
      <Text style={styles.title}>Görevlerim – Oda durumu</Text>
      <Text style={styles.subtitle}>Odalara dokunup durum güncelleyebilirsiniz.</Text>
      <View style={styles.filterRow}>
        {(['all', ...STATUS_OPTIONS] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
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
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loading: { color: theme.colors.textMuted, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.text, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: 4 },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, gap: 8 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: theme.colors.borderLight,
  },
  filterChipActive: { backgroundColor: theme.colors.primary },
  filterChipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: theme.colors.white },
  list: { padding: theme.spacing.lg, paddingBottom: 48 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
  },
  roomNumber: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  floor: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  statusLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginTop: 8 },
  tapHint: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
});
