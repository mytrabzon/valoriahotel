import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { CachedImage } from '@/components/CachedImage';
import { LinkifiedText } from '@/components/LinkifiedText';
import { prefetchImageUrls } from '@/lib/prefetchImageUrls';

type Row = {
  id: string;
  title: string;
  body: string | null;
  image_urls: string[] | null;
  updated_at: string;
};

export default function LocalAreaGuideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const { t } = useTranslation();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const detailReloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('local_area_guide_entries')
      .select('id, title, body, image_urls, updated_at')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();
    if (error || !data) {
      setRow(null);
      return;
    }
    setRow(data as Row);
  }, [id]);

  useEffect(() => {
    setRow(null);
  }, [id]);

  useEffect(() => {
    if (row?.title) {
      navigation.setOptions({ title: row.title });
    } else if (!loading) {
      navigation.setOptions({ title: t('localAreaGuideScreenTitle') });
    }
  }, [navigation, row?.title, loading, t]);

  useEffect(() => {
    if (row?.image_urls && row.image_urls.length > 0) {
      prefetchImageUrls(row.image_urls, 24);
    }
  }, [row?.id, row?.updated_at]);

  const scheduleDetailReload = useCallback(() => {
    if (detailReloadDebounceRef.current) clearTimeout(detailReloadDebounceRef.current);
    detailReloadDebounceRef.current = setTimeout(() => {
      detailReloadDebounceRef.current = null;
      load();
    }, 250);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const ch = supabase
      .channel(`local-area-guide-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'local_area_guide_entries', filter: `id=eq.${id}` },
        () => {
          scheduleDetailReload();
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      if (detailReloadDebounceRef.current) clearTimeout(detailReloadDebounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [id, load, scheduleDetailReload]);

  const imgH = Math.min(280, width * 0.55);
  const lightboxW = Math.min(width - 32, 720);
  const lightboxH = windowHeight * 0.88;

  if (loading && !row) {
    return (
      <View style={styles.root}>
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonTitleBar} />
          <View style={styles.skeletonMetaBar} />
        </View>
        <View style={[styles.skeletonImageSlot, { width, height: imgH }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!row) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t('localAreaGuideNotFound')}</Text>
      </View>
    );
  }

  const images = row.image_urls?.filter(Boolean) ?? [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <Text style={styles.title}>{row.title}</Text>
      <Text style={styles.meta}>
        {t('localAreaGuideUpdated')}{' '}
        {new Date(row.updated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
      </Text>

      {images.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.carousel}>
          {images.map((uri, i) => (
            <Pressable key={uri} onPress={() => setLightboxUri(uri)} style={{ width, height: imgH }}>
              <View style={[styles.carouselSlide, { width, height: imgH }]}>
                <CachedImage
                  uri={uri}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  contentPosition="center"
                  priority={i === 0 ? 'high' : 'low'}
                  recyclingKey={uri}
                />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {row.body?.trim() ? (
        <View style={styles.bodyWrap}>
          <LinkifiedText text={row.body.trim()} textStyle={styles.bodyText} linkStyle={styles.bodyLink} />
        </View>
      ) : null}

      <Modal
        visible={!!lightboxUri}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUri(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.lbOverlay} onPress={() => setLightboxUri(null)} accessibilityLabel={t('close')}>
          {lightboxUri ? (
            <View style={styles.lbContent} pointerEvents="box-none">
              <View style={[styles.lbFrame, { width: lightboxW, height: lightboxH }]}>
                <CachedImage
                  uri={lightboxUri}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  contentPosition="center"
                />
              </View>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { fontSize: 15, color: theme.colors.textMuted, textAlign: 'center' },
  skeletonHeader: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  skeletonTitleBar: {
    height: 22,
    width: '78%',
    maxWidth: 300,
    borderRadius: 8,
    backgroundColor: theme.colors.borderLight,
  },
  skeletonMetaBar: { height: 12, width: 120, borderRadius: 6, backgroundColor: theme.colors.borderLight, opacity: 0.9 },
  skeletonImageSlot: {
    marginTop: 16,
    backgroundColor: theme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Tam boy kutu: decode / progressive sırasında hizalama sabit kalır */
  carouselSlide: { overflow: 'hidden', backgroundColor: theme.colors.borderLight },
  /** Büyük resim: contain öncesi/sonrası orta sabit alan */
  lbFrame: { overflow: 'hidden', backgroundColor: '#0d0d0d' },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  meta: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 16, marginTop: 6 },
  carousel: { marginTop: 16 },
  bodyWrap: { paddingHorizontal: 16, marginTop: 20 },
  bodyText: { fontSize: 16, lineHeight: 24, color: theme.colors.text },
  bodyLink: { color: theme.colors.primary, textDecorationLine: 'underline' },
  lbOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** box-none: boşluklardaki dokunuşlar üstteki kapatma Pressable'a iletilir */
  lbContent: { justifyContent: 'center', alignItems: 'center', padding: 16 },
});
