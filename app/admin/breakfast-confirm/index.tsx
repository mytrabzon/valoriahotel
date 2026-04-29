import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { adminTheme } from '@/constants/adminTheme';
import { BreakfastPhotoLightbox } from '@/components/BreakfastPhotoLightbox';

type Row = {
  id: string;
  record_date: string;
  submitted_at: string;
  guest_count: number;
  note: string | null;
  photo_urls: string[];
  approved_at: string | null;
  staff?: { full_name: string | null; department: string | null } | null;
};

function formatTrDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminBreakfastConfirmListScreen() {
  const router = useRouter();
  const staff = useAuthStore((s) => s.staff);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    if (!staff?.organization_id) return;
    const { data, error } = await supabase
      .from('breakfast_confirmations')
      .select('id, record_date, submitted_at, guest_count, note, photo_urls, approved_at, staff!staff_id(full_name, department)')
      .eq('organization_id', staff.organization_id)
      .order('submitted_at', { ascending: false })
      .limit(200);
    if (error) Alert.alert('Hata', error.message);
    else setRows((data as Row[]) ?? []);
  }, [staff?.organization_id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const approve = async (id: string) => {
    if (!staff?.id) return;
    try {
      const { error } = await supabase
        .from('breakfast_confirmations')
        .update({
          approved_at: new Date().toISOString(),
          approved_by_staff_id: staff.id,
        })
        .eq('id', id);
      if (error) throw new Error(error.message);
      await load();
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Onaylanamadı');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={adminTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BreakfastPhotoLightbox
        visible={lightbox !== null}
        urls={lightbox?.urls ?? []}
        initialIndex={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
      />
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={() => router.push('/admin/breakfast-confirm/settings')} activeOpacity={0.85}>
          <Ionicons name="settings-outline" size={20} color={adminTheme.colors.primary} />
          <Text style={styles.toolBtnText}>Ayarlar</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Kayıt yok.</Text>}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.date}>{item.record_date}</Text>
              {item.approved_at ? <Text style={styles.badgeOk}>Onaylı</Text> : <Text style={styles.badgeWait}>Bekliyor</Text>}
            </View>
            {item.staff?.full_name ? <Text style={styles.name}>{item.staff.full_name}</Text> : null}
            <Text style={styles.meta}>Gönderim: {formatTrDateTime(item.submitted_at)}</Text>
            <Text style={styles.meta}>Fotoğraf: {(item.photo_urls ?? []).length} adet</Text>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            <View style={styles.thumbRow}>
              {(item.photo_urls ?? []).map((u, idx) => (
                <TouchableOpacity
                  key={`${item.id}-${idx}`}
                  activeOpacity={0.88}
                  onPress={() => setLightbox({ urls: item.photo_urls ?? [], index: idx })}
                >
                  <Image source={{ uri: u }} style={styles.thumb} />
                </TouchableOpacity>
              ))}
            </View>
            {!item.approved_at ? (
              <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item.id)} activeOpacity={0.85}>
                <Text style={styles.approveBtnText}>Onayla</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toolbar: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'flex-end' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 },
  toolBtnText: { fontSize: 15, fontWeight: '600', color: adminTheme.colors.primary },
  empty: { textAlign: 'center', color: adminTheme.colors.textMuted, marginTop: 40 },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: adminTheme.colors.borderLight,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  date: { fontSize: 16, fontWeight: '700', color: adminTheme.colors.text },
  badgeOk: { fontSize: 12, fontWeight: '700', color: '#047857' },
  badgeWait: { fontSize: 12, fontWeight: '600', color: '#b45309' },
  name: { fontSize: 15, fontWeight: '600', color: adminTheme.colors.primary, marginBottom: 4 },
  meta: { fontSize: 14, color: adminTheme.colors.textSecondary },
  note: { fontSize: 14, color: adminTheme.colors.text, marginTop: 6 },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumb: {
    width: 104,
    height: 104,
    borderRadius: 10,
    backgroundColor: adminTheme.colors.borderLight,
  },
  approveBtn: {
    marginTop: 12,
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
