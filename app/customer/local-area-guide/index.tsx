import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { CachedImage } from '@/components/CachedImage';
import { prefetchImageUrls } from '@/lib/prefetchImageUrls';

export type LocalAreaGuideListRow = {
  id: string;
  title: string;
  image_urls: string[] | null;
  updated_at: string;
};

export default function LocalAreaGuideListScreen() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const basePath = segments[0] === 'staff' ? '/staff/local-area-guide' : '/customer/local-area-guide';
  const [rows, setRows] = useState<LocalAreaGuideListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('local_area_guide_entries')
      .select('id, title, image_urls, updated_at')
      .eq('is_published', true)
      .order('sort_order', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(80);
    if (error) {
      setRows([]);
      return;
    }
    const list = (data ?? []) as LocalAreaGuideListRow[];
    setRows(list);
    prefetchImageUrls(
      list.map((r) => r.image_urls?.[0] ?? null),
      20
    );
  }, []);

  const scheduleReload = useCallback(() => {
    if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
    reloadDebounceRef.current = setTimeout(() => {
      reloadDebounceRef.current = null;
      load();
    }, 300);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const ch = supabase
      .channel('local-area-guide-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'local_area_guide_entries' },
        () => {
          scheduleReload();
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [load, scheduleReload]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const listPad = 16;
  const cardW = width - listPad * 2;
  /** Tıklanmadan da fotoğraf önizlemesi net ve ortadan kırpılsın */
  const THUMB = 120;

  const renderItem = useCallback(
    ({ item, index }: { item: LocalAreaGuideListRow; index: number }) => {
      const cover = item.image_urls?.[0] ?? null;
      return (
        <TouchableOpacity
          style={[styles.card, { width: cardW, minHeight: THUMB + 8 }]}
          onPress={() => router.push(`${basePath}/${item.id}` as never)}
          activeOpacity={0.9}
        >
          <View style={[styles.thumbBox, { width: THUMB, height: THUMB, borderRadius: 16 }]}>
            {cover ? (
              <CachedImage
                uri={cover}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="center"
                priority={index < 6 ? 'high' : 'normal'}
                recyclingKey={cover}
              />
            ) : (
              <View style={styles.thumbPh}>
                <Ionicons name="trail-sign-outline" size={40} color={theme.colors.primary} />
              </View>
            )}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardDate}>
              {new Date(item.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
          <View style={styles.chevronCol}>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.textMuted} />
          </View>
        </TouchableOpacity>
      );
    },
    [THUMB, basePath, cardW, router]
  );

  return (
    <View style={[styles.root, { paddingTop: 8 }]}>
      <Text style={[styles.intro, { paddingHorizontal: listPad, width }]}>{t('localAreaGuideListIntro')}</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24, paddingTop: 4, paddingHorizontal: listPad }]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.empty}>{t('loading')}</Text>
          ) : (
            <Text style={styles.empty}>{t('localAreaGuideListEmpty')}</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  intro: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 12, lineHeight: 20 },
  list: { paddingHorizontal: 0 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  /** Sabit kutu + absoluteFill: decode sırasında hizalama zıplamasını azaltır */
  thumbBox: {
    overflow: 'hidden',
    backgroundColor: theme.colors.borderLight,
  },
  thumbPh: { flex: 1, width: '100%', height: '100%', backgroundColor: theme.colors.borderLight, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, lineHeight: 22 },
  cardDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6 },
  chevronCol: { justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch', width: 28, opacity: 0.9 },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 48, fontSize: 15 },
});
