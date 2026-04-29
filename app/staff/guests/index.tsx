import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { CachedImage } from '@/components/CachedImage';
import { guestDisplayName } from '@/lib/guestDisplayName';

type GuestCard = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

export default function StaffGuestsIndexScreen() {
  const router = useRouter();
  const [guests, setGuests] = useState<GuestCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGuests = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('guests')
      .select('id, full_name, photo_url, banned_until')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(120);
    if (error) {
      setLoadError(error.message || 'Misafirler yuklenemedi.');
      setGuests([]);
      return;
    }
    setLoadError(null);
    const rows = (data ?? []) as (GuestCard & { banned_until?: string | null })[];
    const visible = rows.filter((g) => !g.banned_until || g.banned_until < nowIso);
    setGuests(visible.map(({ banned_until: _, ...g }) => g));
  }, []);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  return (
    <View style={styles.container}>
      <FlatList
        data={guests}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrap}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await loadGuests();
          setRefreshing(false);
        }} />}
        renderItem={({ item }) => {
          const name = guestDisplayName(item.full_name, 'Misafir');
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/staff/guests/${item.id}`)}
            >
              {item.photo_url ? (
                <CachedImage uri={item.photo_url} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                Misafir Profili
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{loadError || 'Misafir bulunamadi.'}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  listContent: { padding: 14, paddingBottom: 26 },
  columnWrap: { gap: 12 },
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 170,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 10, backgroundColor: theme.colors.borderLight },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
    backgroundColor: theme.colors.guestAvatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: theme.colors.guestAvatarLetter, fontSize: 24, fontWeight: '800' },
  name: { fontSize: 14, color: theme.colors.text, fontWeight: '700', maxWidth: '100%' },
  meta: { marginTop: 4, fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40, fontSize: 14 },
});
