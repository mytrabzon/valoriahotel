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
import { theme } from '@/constants/theme';
import { canBreakfastApproveUi, canBreakfastDepartmentViewUi } from '@/lib/breakfastConfirm';
import { BreakfastPhotoLightbox } from '@/components/BreakfastPhotoLightbox';
import { useTranslation } from 'react-i18next';

type Row = {
  id: string;
  record_date: string;
  guest_count: number;
  note: string | null;
  photo_urls: string[];
  staff_id: string;
  approved_at: string | null;
  staff?: { full_name: string | null; department: string | null } | null;
};

export default function BreakfastConfirmListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const staff = useAuthStore((s) => s.staff);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const canApprove = staff ? canBreakfastApproveUi(staff) : false;
  const isDeptView = staff ? canBreakfastDepartmentViewUi(staff) : false;

  const load = useCallback(async () => {
    if (!staff?.organization_id) return;
    const { data, error } = await supabase
      .from('breakfast_confirmations')
      .select('id, record_date, guest_count, note, photo_urls, staff_id, approved_at, staff!staff_id(full_name, department)')
      .eq('organization_id', staff.organization_id)
      .order('record_date', { ascending: false })
      .limit(120);
    if (error) {
      Alert.alert(t('error'), error.message);
    } else {
      setRows((data as Row[]) ?? []);
    }
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
      Alert.alert(t('error'), (e as Error)?.message ?? t('breakfastApproveFailed'));
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
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
      <Text style={styles.hint}>
        {isDeptView
          ? t('breakfastListDeptHint')
          : t('breakfastListMineHint')}
      </Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('emptyNoRecords')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.date}>{item.record_date}</Text>
              {item.approved_at ? (
                <Text style={styles.badgeOk}>{t('approved')}</Text>
              ) : (
                <Text style={styles.badgeWait}>{t('pendingApproval')}</Text>
              )}
            </View>
            {item.staff?.full_name ? (
              <Text style={styles.name}>{item.staff.full_name}</Text>
            ) : null}
            <Text style={styles.meta}>{`${t('breakfastGuestCount')}: ${item.guest_count}`}</Text>
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
            {canApprove && !item.approved_at ? (
              <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item.id)} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.approveBtnText}>{t('approve')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      />
      <TouchableOpacity style={styles.fabBack} onPress={() => router.back()} activeOpacity={0.85}>
        <Text style={styles.fabBackText}>{t('breakfastBackToConfirm')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { padding: 16, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  date: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  badgeOk: { fontSize: 12, fontWeight: '700', color: '#047857' },
  badgeWait: { fontSize: 12, fontWeight: '600', color: '#b45309' },
  name: { fontSize: 15, fontWeight: '600', color: theme.colors.primary, marginBottom: 4 },
  meta: { fontSize: 14, color: theme.colors.textSecondary },
  note: { fontSize: 14, color: theme.colors.text, marginTop: 6 },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: theme.colors.borderLight,
  },
  approveBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fabBack: { padding: 16, alignItems: 'center' },
  fabBackText: { color: theme.colors.primary, fontWeight: '600', fontSize: 16 },
});
