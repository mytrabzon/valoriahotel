import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useCustomerRoomStore } from '@/stores/customerRoomStore';
import { hasPolicyConsent } from '@/lib/policyConsent';
import { theme } from '@/constants/theme';

type RoomRow = {
  id: string;
  room_number: string;
  floor: number | null;
  view_type: string | null;
  status: string;
};

export default function RoomSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const setPendingRoom = useCustomerRoomStore((s) => s.setPendingRoom);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase
        .from('rooms')
        .select('id, room_number, floor, view_type, status')
        .in('status', ['available', 'occupied'])
        .order('room_number');
      if (e) {
        setError(e.message);
        setRooms([]);
      } else {
        setRooms(data ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const onSelectRoom = async (room: RoomRow) => {
    const accepted = await hasPolicyConsent();
    if (!accepted) {
      router.push({ pathname: '/policies', params: { next: 'customer', roomId: room.id, roomNumber: room.room_number } });
      return;
    }
    setPendingRoom(room.id, room.room_number);
    router.replace('/auth');
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.hero}>
          <Text style={styles.title}>Konaklama</Text>
          <Text style={styles.subtitle}>Odalar yükleniyor...</Text>
        </View>
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.hero}>
        <Text style={styles.title}>Konaklama</Text>
        <Text style={styles.subtitle}>Odanızı seçin, giriş yapın ve otelin tüm hizmetlerinden yararlanın.</Text>
      </View>

      {error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Geri</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          numColumns={width > 400 ? 2 : 1}
          columnWrapperStyle={width > 400 ? styles.row : undefined}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.roomCard}
              onPress={() => onSelectRoom(item)}
              activeOpacity={0.88}
            >
              <View style={styles.roomCardAccent} />
              <View style={styles.roomCardInner}>
                <View style={styles.roomCardIconWrap}>
                  <Ionicons name="bed-outline" size={26} color={theme.colors.primary} />
                </View>
                <Text style={styles.roomNumber}>Oda {item.room_number}</Text>
                <View style={styles.roomChips}>
                  {item.view_type ? (
                    <View style={styles.roomChip}>
                      <Text style={styles.roomChipText}>{item.view_type}</Text>
                    </View>
                  ) : null}
                  {item.floor != null ? (
                    <View style={styles.roomChip}>
                      <Ionicons name="layers-outline" size={12} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.roomChipText}>{item.floor}. kat</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.roomButton}>
                  <Text style={styles.roomButtonText}>Bu oda ile giriş yap</Text>
                  <Ionicons name="arrow-forward" size={18} color="#0f1419" />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={[styles.backBtn, styles.backBtnBottom]} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Geri</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  hero: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 22,
  },
  loader: { marginTop: 32 },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  row: { gap: 14, marginBottom: 14 },
  roomCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
  },
  roomCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.colors.primary,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  roomCardInner: { padding: 18, paddingLeft: 22 },
  roomCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 168, 75, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  roomNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  roomChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  roomChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  roomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  roomButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f1419',
  },
  errorBlock: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#fc8181', marginBottom: 16, textAlign: 'center' },
  backBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  backBtnBottom: { marginTop: 16 },
  backBtnText: { color: theme.colors.primaryLight, fontSize: 16, fontWeight: '600' },
});
