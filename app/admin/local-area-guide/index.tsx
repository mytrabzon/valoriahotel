import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { adminTheme } from '@/constants/adminTheme';
import { CachedImage } from '@/components/CachedImage';

type Row = {
  id: string;
  title: string;
  image_urls: string[] | null;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
};

export default function AdminLocalAreaGuideList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { staff } = useAuthStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('local_area_guide_entries')
      .select('id, title, image_urls, is_published, sort_order, updated_at')
      .order('sort_order', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) {
      setRows([]);
      return;
    }
    setRows((data ?? []) as Row[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let c = true;
      setLoading(true);
      load().finally(() => {
        if (c) setLoading(false);
      });
      return () => {
        c = false;
      };
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const createNew = async () => {
    if (!staff?.organization_id) return;
    const { data, error } = await supabase
      .from('local_area_guide_entries')
      .insert({
        organization_id: staff.organization_id,
        title: t('localAreaGuideDraftTitle'),
        body: '',
        image_urls: [],
        is_published: false,
        sort_order: 0,
        created_by_staff_id: staff.id,
      })
      .select('id')
      .single();
    if (error || !data) {
      Alert.alert(t('error'), error?.message ?? 'insert');
      return;
    }
    router.push(`/admin/local-area-guide/${(data as { id: string }).id}`);
  };

  const thumb = (r: Row) => (r.image_urls && r.image_urls[0]) || null;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && rows.length === 0 ? (
          <Text style={styles.muted}>{t('loading')}</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>{t('localAreaGuideAdminEmpty')}</Text>
        ) : (
          rows.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.card}
              onPress={() => router.push(`/admin/local-area-guide/${r.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.thumbWrap}>
                {thumb(r) ? (
                  <CachedImage uri={thumb(r)!} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={styles.thumbPh}>
                    <Ionicons name="image-outline" size={28} color={adminTheme.colors.textMuted} />
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{r.title}</Text>
                <Text style={styles.cardMeta}>
                  {r.is_published ? t('localAreaGuidePublished') : t('localAreaGuideDraft')}
                  {' · '}
                  {new Date(r.updated_at).toLocaleString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={adminTheme.colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={createNew} activeOpacity={0.9}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: adminTheme.colors.background },
  scroll: { padding: 16, paddingBottom: 100 },
  muted: { color: adminTheme.colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: adminTheme.colors.border,
  },
  thumbWrap: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbPh: {
    flex: 1,
    backgroundColor: adminTheme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: adminTheme.colors.text },
  cardMeta: { fontSize: 12, color: adminTheme.colors.textMuted, marginTop: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: adminTheme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
