import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { staffGetOrCreateDirectConversation } from '@/lib/messagingApi';

type GuestRow = {
  id: string;
  full_name: string | null;
  rooms?: { room_number: string } | null;
  room_id?: string | null;
  status?: string | null;
};

type StaffRow = {
  id: string;
  full_name: string | null;
  department: string | null;
  is_online: boolean | null;
  role?: string | null;
};

type RowItem = {
  id: string;
  name: string;
  sub: string;
  type: 'guest' | 'staff';
};

export default function StaffNewChatScreen() {
  const router = useRouter();
  const { staff } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!staff) return;
      const [gRes, sRes] = await Promise.all([
        supabase
          .from('guests')
          .select('id, full_name, room_id, status, rooms(room_number)')
          .in('status', ['checked_in'])
          .order('full_name'),
        supabase
          .from('staff')
          .select('id, full_name, department, is_online, role')
          .eq('is_active', true)
          .neq('id', staff.id)
          .order('full_name'),
      ]);
      if (cancelled) return;
      setGuests((gRes.data ?? []) as GuestRow[]);
      setStaffList((sRes.data ?? []) as StaffRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [staff]);

  const sections = useMemo(() => {
    const query = q.trim().toLocaleLowerCase('tr-TR');
    const matches = (s: string) => (query.length === 0 ? true : s.toLocaleLowerCase('tr-TR').includes(query));

    const guestItems: RowItem[] = guests
      .map((g) => {
        const roomNumber = (g.rooms as { room_number?: string } | null)?.room_number ?? null;
        return {
          id: g.id,
          name: g.full_name || 'Misafir',
          sub: roomNumber ? `Oda ${roomNumber}` : '—',
          type: 'guest' as const,
        };
      })
      .filter((x) => matches(`${x.name} ${x.sub}`));

    const staffItems: RowItem[] = staffList
      .map((s) => ({
        id: s.id,
        name: s.full_name || 'Personel',
        sub: s.department || s.role || '—',
        type: 'staff' as const,
      }))
      .filter((x) => matches(`${x.name} ${x.sub}`));

    const out: { title: string; data: RowItem[] }[] = [];
    if (guestItems.length) out.push({ title: 'Misafirler', data: guestItems });
    if (staffItems.length) out.push({ title: 'Personel', data: staffItems });
    return out;
  }, [guests, staffList, q]);

  const start = async (item: RowItem) => {
    if (!staff) return;
    setStarting(item.id);
    const convId = await staffGetOrCreateDirectConversation(staff.id, item.id, item.type);
    setStarting(null);
    if (convId) router.replace({ pathname: '/staff/chat/[id]', params: { id: convId } });
  };

  if (!staff) return null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Kişiler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Misafir veya personel ara"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!q && (
          <Pressable onPress={() => setQ('')} hitSlop={10} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={44} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Kişi bulunamadı</Text>
          <Text style={styles.emptyText}>Aramanızı değiştirin veya daha sonra tekrar deneyin.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.type}:${item.id}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => start(item)}
              disabled={!!starting}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              android_ripple={{ color: theme.colors.borderLight }}
            >
              <View style={[styles.avatar, item.type === 'guest' ? styles.avatarGuest : styles.avatarStaff]}>
                <Text style={styles.avatarText} numberOfLines={1}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.sub}
                </Text>
              </View>
              {starting === item.id ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: theme.spacing.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  clearBtn: {
    paddingLeft: 6,
  },
  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  sectionHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginVertical: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    ...theme.shadows.sm,
  },
  rowPressed: {
    opacity: 0.9,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarGuest: {
    backgroundColor: theme.colors.primary,
  },
  avatarStaff: {
    backgroundColor: theme.colors.primaryDark,
  },
  avatarText: {
    color: theme.colors.white,
    fontWeight: '800',
    fontSize: 18,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  rowSub: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xxl,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});

