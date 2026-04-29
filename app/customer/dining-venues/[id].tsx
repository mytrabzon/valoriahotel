import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Linking,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { CachedImage } from '@/components/CachedImage';
import {
  venueRowFromDb,
  galleryUrls,
  priceLevelLabel,
  formatDiningMenuPriceTry,
  venueAvatarUrl,
  type DiningMenuItem,
  type DiningVenueRow,
} from '@/lib/diningVenues';
import { DiningVenueRouteMap } from '@/components/DiningVenueRouteMap';

export default function CustomerDiningVenueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height: winH } = useWindowDimensions();
  const [mapOpen, setMapOpen] = useState(false);

  const [row, setRow] = useState<DiningVenueRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [gIdx, setGIdx] = useState(0);
  const [menuDetail, setMenuDetail] = useState<DiningMenuItem | null>(null);
  const lightboxScrollRef = useRef<ScrollView>(null);

  const menuGap = 10;
  const menuColW = useMemo(
    () => Math.max(120, (width - 40 - menuGap) / 2),
    [width]
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.from('dining_venues').select('*').eq('id', id).eq('is_active', true).maybeSingle();
    if (error || !data) {
      setRow(null);
      setLoading(false);
      return;
    }
    setRow(venueRowFromDb(data as Record<string, unknown>));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const images = useMemo(() => (row ? galleryUrls(row) : []), [row]);
  const menu = useMemo(
    () => (row && Array.isArray(row.menu_items) ? row.menu_items : []),
    [row]
  );
  const venueMapAvatar = useMemo(
    () => (row ? venueAvatarUrl(row) : null),
    [row]
  );

  useEffect(() => {
    if (lightboxIndex == null || images.length === 0) return;
    const x = Math.max(0, Math.min(lightboxIndex, images.length - 1)) * width;
    requestAnimationFrame(() => {
      lightboxScrollRef.current?.scrollTo({ x, animated: false });
    });
  }, [lightboxIndex, images, width]);

  const openMaps = () => {
    if (!row) return;
    if (row.lat != null && row.lng != null) {
      if (Platform.OS === 'ios') {
        void Linking.openURL(`http://maps.apple.com/?daddr=${row.lat},${row.lng}&dirflg=d`);
      } else {
        void Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${row.lat},${row.lng}&travelmode=driving`
        );
      }
    } else if (row.address) {
      void Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.address)}`
      );
    }
  };

  const call = () => {
    if (!row?.phone?.trim()) return;
    const p = row.phone.replace(/\s/g, '');
    Linking.openURL(`tel:${p}`);
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  if (!row) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>{t('diningVenuesNotFound')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                setGIdx(Math.round(x / width));
              }}
              scrollEventThrottle={16}
            >
              {images.map((uri) => (
                <TouchableOpacity
                  key={uri}
                  activeOpacity={0.95}
                  onPress={() => setLightboxIndex(images.indexOf(uri))}
                >
                  <CachedImage uri={uri} style={{ width, height: 260 }} contentFit="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {images.length > 1 ? (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === gIdx && styles.dotOn]} />
                ))}
              </View>
            ) : null}
            <View style={styles.galHint}>
              <Ionicons name="expand-outline" size={16} color="#fff" />
              <Text style={styles.galHintT}> {t('diningVenuesTapGallery')}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.ph, { width }]}>
            <Ionicons name="restaurant-outline" size={56} color={theme.colors.textMuted} />
          </View>
        )}

        <View style={styles.pad}>
          <Text style={styles.title}>{row.name}</Text>
          <Text style={styles.sub}>
            {(row.cuisine_tags ?? []).join(' · ') || t(`diningVenuesType_${row.venue_type}`)} · {t('diningVenuesPrice')}{' '}
            {priceLevelLabel(row.price_level)}
          </Text>
          {row.description ? <Text style={styles.body}>{row.description}</Text> : null}

          <View style={styles.kv}>
            {row.opening_hours ? (
              <View style={styles.kvRow}>
                <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.kvT}>
                  {t('diningVenuesOpenHours')}: {row.opening_hours}
                </Text>
              </View>
            ) : null}
            {row.phone ? (
              <TouchableOpacity style={styles.kvRow} onPress={call}>
                <Ionicons name="call-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.kvT, styles.link]}>{row.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {row.address ? (
              <View style={styles.kvRow}>
                <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.kvT}>{row.address}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            {row.phone ? (
              <TouchableOpacity style={styles.btn} onPress={call} activeOpacity={0.9}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.btnT}>{t('diningVenuesCall')}</Text>
              </TouchableOpacity>
            ) : null}
            {row.lat != null && row.lng != null && Number.isFinite(row.lat) && Number.isFinite(row.lng) ? (
              <TouchableOpacity style={styles.btn} onPress={() => setMapOpen(true)} activeOpacity={0.9}>
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.btnT}>{t('diningVenuesInAppMap')}</Text>
              </TouchableOpacity>
            ) : null}
            {row.address || (row.lat != null && row.lng != null) ? (
              <TouchableOpacity style={[styles.btn, styles.btn2]} onPress={openMaps} activeOpacity={0.9}>
                <Ionicons name="map-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.btnT2}>{t('diningVenuesOpenInMapsApp')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {row.directions_text ? (
            <View style={styles.block}>
              <Text style={styles.h}>{t('diningVenuesHowToGetThere')}</Text>
              <Text style={styles.body}>{row.directions_text}</Text>
            </View>
          ) : null}
          {row.reservation_info ? (
            <View style={styles.block}>
              <Text style={styles.h}>{t('diningVenuesReservation')}</Text>
              <Text style={styles.body}>{row.reservation_info}</Text>
            </View>
          ) : null}

          {menu.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.h}>{t('diningVenuesMenuPeek')}</Text>
              <Text style={styles.menuHint}>{t('diningVenuesMenuItemHint')}</Text>
              <View style={styles.menuGrid}>
                {menu.map((m, i) => (
                  <TouchableOpacity
                    key={`${m.name}-${i}`}
                    style={[styles.menuCard, { width: menuColW }]}
                    onPress={() => setMenuDetail(m)}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel={m.name}
                  >
                    <View style={styles.menuCardImgWrap}>
                      {m.image_url ? (
                        <CachedImage uri={m.image_url} style={styles.menuCardImg} contentFit="cover" />
                      ) : (
                        <Ionicons name="restaurant-outline" size={40} color={theme.colors.textMuted} />
                      )}
                    </View>
                    <View style={styles.menuCardBody}>
                      <Text style={styles.menuCardName} numberOfLines={2}>
                        {m.name}
                      </Text>
                      {m.price != null ? (
                        <Text style={styles.menuCardPrice}>
                          {formatDiningMenuPriceTry(i18n.language, m.price)}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <Modal visible={mapOpen} animationType="slide" onRequestClose={() => setMapOpen(false)} presentationStyle="pageSheet">
        <View style={[styles.mapModalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.mapModalHeader}>
            <Text style={styles.mapModalTitle}>{t('diningVenuesInAppMap')}</Text>
            <Pressable onPress={() => setMapOpen(false)} hitSlop={12} accessibilityRole="button">
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </Pressable>
          </View>
          {row.lat != null && row.lng != null ? (
            <DiningVenueRouteMap
              venueId={row.id}
              name={row.name}
              lat={row.lat}
              lng={row.lng}
              avatarUrl={venueMapAvatar}
              minHeight={Math.max(300, winH * 0.5)}
              style={styles.mapModalMap}
            />
          ) : null}
          <TouchableOpacity style={styles.mapModalExternal} onPress={() => { setMapOpen(false); openMaps(); }}>
            <Text style={styles.mapModalExternalT}>{t('diningVenuesOpenInMapsApp')}</Text>
            <Ionicons name="open-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal
        visible={menuDetail != null}
        animationType="slide"
        transparent
        onRequestClose={() => setMenuDetail(null)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
      >
        <View style={styles.menuDetailRoot} pointerEvents="box-none">
          <Pressable
            style={styles.menuDetailBackdrop}
            onPress={() => setMenuDetail(null)}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
          />
          <View
            style={[
              styles.menuDetailSheet,
              { paddingBottom: Math.max(16, insets.bottom + 8), maxHeight: winH * 0.9 },
            ]}
          >
            <View style={styles.menuDetailHandle} />
            <View style={styles.menuDetailHeader}>
              <Text style={styles.menuDetailTitle} numberOfLines={1}>
                {t('diningVenuesDishDetails')}
              </Text>
              <Pressable onPress={() => setMenuDetail(null)} hitSlop={12} accessibilityRole="button">
                <Ionicons name="close" size={26} color={theme.colors.text} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.menuDetailScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {menuDetail?.image_url ? (
                <CachedImage
                  uri={menuDetail.image_url}
                  style={styles.menuDetailImg}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.menuDetailImgPh}>
                  <Ionicons name="restaurant-outline" size={56} color={theme.colors.textMuted} />
                </View>
              )}
              <Text style={styles.menuDetailName}>{menuDetail?.name}</Text>
              {menuDetail?.price != null ? (
                <Text style={styles.menuDetailPrice}>
                  {formatDiningMenuPriceTry(i18n.language, menuDetail.price)}
                </Text>
              ) : null}
              {menuDetail?.description?.trim() ? (
                <Text style={styles.menuDetailDesc}>{menuDetail.description}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={lightboxIndex != null && images.length > 0}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setLightboxIndex(null)}
      >
        <View style={[styles.lightboxRoot, { paddingTop: insets.top }]}>
          <Pressable
            style={[styles.lightboxClose, { top: insets.top + 8 }]}
            onPress={() => setLightboxIndex(null)}
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <ScrollView
            ref={lightboxScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {images.map((uri) => (
              <View key={uri} style={{ width, height: winH * 0.88 }}>
                <CachedImage uri={uri} style={styles.lightboxImg} contentFit="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: theme.colors.textMuted },
  ph: { height: 220, backgroundColor: theme.colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 20, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  sub: { fontSize: 15, color: theme.colors.textSecondary, marginTop: 4, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, color: theme.colors.text, marginTop: 12 },
  dots: { position: 'absolute', bottom: 36, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotOn: { backgroundColor: '#fff' },
  galHint: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  galHintT: { color: '#fff', fontSize: 12, fontWeight: '600' },
  kv: { marginTop: 16, gap: 12 },
  kvRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kvT: { flex: 1, fontSize: 15, color: theme.colors.text, lineHeight: 22 },
  link: { color: theme.colors.primary, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  btn2: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderLight },
  btnT: { color: '#fff', fontWeight: '800' },
  btnT2: { color: theme.colors.primary, fontWeight: '800' },
  block: { marginTop: 20 },
  h: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 2 },
  menuHint: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 10, lineHeight: 18 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuCard: {
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderLight,
    overflow: 'hidden',
  },
  menuCardImgWrap: {
    height: 120,
    width: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCardImg: { width: '100%', height: '100%' },
  menuCardBody: { padding: 10, gap: 4 },
  menuCardName: { fontSize: 15, fontWeight: '700', color: theme.colors.text, lineHeight: 20 },
  menuCardPrice: { fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  menuDetailRoot: { flex: 1, justifyContent: 'flex-end' },
  menuDetailBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  menuDetailSheet: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  menuDetailHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderLight,
    alignSelf: 'center',
    marginBottom: 8,
  },
  menuDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  menuDetailTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, flex: 1, paddingRight: 8 },
  menuDetailScroll: {},
  menuDetailImg: { width: '100%', height: 220, borderRadius: 16, backgroundColor: theme.colors.surface, marginBottom: 14 },
  menuDetailImgPh: {
    height: 220,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  menuDetailName: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.2 },
  menuDetailPrice: { fontSize: 20, fontWeight: '800', color: theme.colors.primary, marginTop: 6 },
  menuDetailDesc: { fontSize: 16, lineHeight: 24, color: theme.colors.text, marginTop: 12 },
  lightboxRoot: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  lightboxClose: { position: 'absolute', right: 12, zIndex: 2, padding: 8 },
  lightboxImg: { width: '100%', height: '100%' },
  mapModalRoot: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  mapModalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, flex: 1 },
  mapModalMap: { marginHorizontal: 12 },
  mapModalExternal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  mapModalExternalT: { fontSize: 15, fontWeight: '700', color: theme.colors.primary },
});
