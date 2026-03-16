import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGuestMessagingStore } from '@/stores/guestMessagingStore';
import { guestGetOrCreateConversationWithStaff } from '@/lib/messagingApi';
import { supabase } from '@/lib/supabase';
import { MESSAGING_COLORS } from '@/lib/messaging';

type StaffRow = {
  id: string;
  full_name: string | null;
  department: string | null;
  profile_image: string | null;
  is_online: boolean | null;
  role: string;
};

export default function NewChatScreen() {
  const router = useRouter();
  const { appToken } = useGuestMessagingStore();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, department, profile_image, is_online, role')
      .eq('is_active', true)
      .order('full_name');
    setStaff(data ?? []);
    setLoading(false);
  };

  const startChat = async (staffId: string) => {
    if (!appToken) {
      router.replace('/customer/(tabs)/messages');
      return;
    }
    setStartingId(staffId);
    const convId = await guestGetOrCreateConversationWithStaff(appToken, staffId);
    setStartingId(null);
    if (convId) router.replace({ pathname: '/customer/chat/[id]', params: { id: convId } });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={MESSAGING_COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Personel ile sohbet başlat</Text>
      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => startChat(item.id)}
            disabled={!!startingId}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: item.profile_image || 'https://via.placeholder.com/56' }}
              style={styles.avatar}
            />
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.full_name || 'Personel'}</Text>
              <Text style={styles.dept}>
                {item.department || item.role || '—'}
                {item.is_online ? '  ·  🟢 Çevrimiçi' : ''}
              </Text>
            </View>
            {startingId === item.id ? (
              <ActivityIndicator size="small" color={MESSAGING_COLORS.primary} />
            ) : (
              <Text style={styles.arrow}>→</Text>
            )}
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
    fontSize: 14,
    fontWeight: '600',
    color: MESSAGING_COLORS.textSecondary,
    marginHorizontal: 16,
    marginTop: 12,
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
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  rowBody: { flex: 1 },
  name: { fontWeight: '600', fontSize: 16, color: MESSAGING_COLORS.text },
  dept: { fontSize: 13, color: MESSAGING_COLORS.textSecondary, marginTop: 2 },
  arrow: { fontSize: 18, color: MESSAGING_COLORS.textSecondary },
});
