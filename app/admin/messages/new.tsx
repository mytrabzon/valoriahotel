import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { staffGetOrCreateDirectConversation } from '@/lib/messagingApi';
import { supabase } from '@/lib/supabase';
import { MESSAGING_COLORS } from '@/lib/messaging';

type GuestRow = { id: string; full_name: string | null; room_id: string | null; rooms: { room_number: string } | null };
type StaffRow = { id: string; full_name: string | null; department: string | null; profile_image: string | null; is_online: boolean | null };

export default function AdminNewChatScreen() {
  const router = useRouter();
  const { staff } = useAuthStore();
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [gRes, sRes] = await Promise.all([
      supabase.from('guests').select('id, full_name, room_id, rooms(room_number)').eq('status', 'checked_in').order('full_name'),
      supabase.from('staff').select('id, full_name, department, profile_image, is_online').eq('is_active', true).neq('id', staff?.id ?? '').order('full_name'),
    ]);
    setGuests(gRes.data ?? []);
    setStaffList(sRes.data ?? []);
    setLoading(false);
  };

  const startWithGuest = async (guestId: string) => {
    if (!staff) return;
    setStarting(guestId);
    const convId = await staffGetOrCreateDirectConversation(staff.id, guestId, 'guest');
    setStarting(null);
    if (convId) router.replace({ pathname: '/admin/messages/chat/[id]', params: { id: convId } });
  };

  const startWithStaff = async (otherStaffId: string) => {
    if (!staff) return;
    setStarting(otherStaffId);
    const convId = await staffGetOrCreateDirectConversation(staff.id, otherStaffId, 'staff');
    setStarting(null);
    if (convId) router.replace({ pathname: '/admin/messages/chat/[id]', params: { id: convId } });
  };

  if (!staff) return null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={MESSAGING_COLORS.primary} />
      </View>
    );
  }

  const sections: { title: string; data: { id: string; name: string; sub: string; type: 'guest' | 'staff' }[] }[] = [
    { title: 'Misafirler (checked-in)', data: guests.map((g) => ({ id: g.id, name: g.full_name || 'Misafir', sub: (g.rooms as { room_number?: string })?.room_number ? `Oda ${(g.rooms as { room_number: string }).room_number}` : '—', type: 'guest' as const })) },
    { title: 'Personel', data: staffList.map((s) => ({ id: s.id, name: s.full_name || 'Personel', sub: s.department || '—', type: 'staff' as const })) },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => (item.type === 'guest' ? startWithGuest(item.id) : startWithStaff(item.id))}
            disabled={!!starting}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>{item.sub}</Text>
            </View>
            {starting === item.id ? <ActivityIndicator size="small" color={MESSAGING_COLORS.primary} /> : <Text style={styles.arrow}>→</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MESSAGING_COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: MESSAGING_COLORS.textSecondary,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: MESSAGING_COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rowBody: { flex: 1 },
  name: { fontWeight: '600', fontSize: 16, color: MESSAGING_COLORS.text },
  sub: { fontSize: 13, color: MESSAGING_COLORS.textSecondary, marginTop: 2 },
  arrow: { fontSize: 18, color: MESSAGING_COLORS.textSecondary },
});
