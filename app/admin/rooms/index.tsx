import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { adminTheme } from '@/constants/adminTheme';
import { AdminButton, AdminCard } from '@/components/admin';

type Room = {
  id: string;
  room_number: string;
  floor: number | null;
  status: string;
  view_type: string | null;
  bed_type: string | null;
  price_per_night: number | null;
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Müsait',
  occupied: 'Dolu',
  cleaning: 'Temizlik',
  maintenance: 'Bakım',
  out_of_order: 'Kullanılmıyor',
};

const statusColor: Record<string, string> = {
  available: adminTheme.colors.success,
  occupied: adminTheme.colors.error,
  cleaning: adminTheme.colors.warning,
  maintenance: adminTheme.colors.info,
  out_of_order: adminTheme.colors.textMuted,
};

function RoomCard({ item, onPress }: { item: Room; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 12 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.card}
      >
        <View style={styles.cardRow}>
          <View style={styles.roomInfo}>
            <Text style={styles.roomNum}>Oda {item.room_number}</Text>
            {item.floor != null && (
              <Text style={styles.meta}>Kat {item.floor}</Text>
            )}
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.badge, { backgroundColor: statusColor[item.status] || adminTheme.colors.textMuted }]}>
              <Text style={styles.badgeText}>{STATUS_LABELS[item.status] || item.status}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={adminTheme.colors.textMuted} />
          </View>
        </View>
        {item.price_per_night != null && (
          <Text style={styles.price}>₺{item.price_per_night} <Text style={styles.priceUnit}>/ gece</Text></Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function RoomsList() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('rooms')
        .select('id, room_number, floor, status, view_type, bed_type, price_per_night')
        .order('room_number');
      setRooms(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loading}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <AdminButton
          title="Yeni oda ekle"
          onPress={() => router.push('/admin/rooms/new')}
          variant="accent"
          size="md"
          leftIcon={<Ionicons name="add" size={20} color="#fff" />}
          fullWidth
        />
      </View>
      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        listEmptyComponent={
          <AdminCard>
            <Text style={styles.emptyText}>Henüz oda tanımlı değil.</Text>
            <AdminButton
              title="İlk odayı ekle"
              onPress={() => router.push('/admin/rooms/new')}
              variant="primary"
              size="md"
              style={{ marginTop: 16 }}
            />
          </AdminCard>
        }
        renderItem={({ item }) => (
          <RoomCard item={item} onPress={() => router.push(`/admin/rooms/${item.id}`)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: adminTheme.colors.surfaceSecondary,
  },
  loadingWrap: {
    padding: 24,
    alignItems: 'center',
  },
  loading: {
    fontSize: 15,
    color: adminTheme.colors.textSecondary,
  },
  topBar: {
    padding: 20,
    paddingBottom: 8,
    backgroundColor: adminTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: adminTheme.colors.border,
  },
  list: {
    padding: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: adminTheme.colors.surface,
    padding: 18,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    ...Platform.select({
      ios: adminTheme.shadow.sm,
      android: { elevation: 2 },
    }),
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  roomInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomNum: {
    fontSize: 18,
    fontWeight: '700',
    color: adminTheme.colors.text,
  },
  meta: {
    fontSize: 13,
    color: adminTheme.colors.textSecondary,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: adminTheme.radius.sm,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: adminTheme.colors.accent,
    marginTop: 10,
  },
  priceUnit: {
    fontWeight: '500',
    color: adminTheme.colors.textSecondary,
    fontSize: 13,
  },
  emptyText: {
    fontSize: 15,
    color: adminTheme.colors.textSecondary,
    textAlign: 'center',
  },
});
