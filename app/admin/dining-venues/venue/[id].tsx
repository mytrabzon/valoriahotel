import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, usePathname, type Href } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { adminTheme } from '@/constants/adminTheme';
import { CachedImage } from '@/components/CachedImage';
import { Ionicons } from '@expo/vector-icons';
import { canManageDiningVenues } from '@/lib/diningVenuesPermissions';
import { uploadDiningVenueImage } from '@/lib/diningVenuesUpload';
import {
  type DiningMenuItem,
  type VenueType,
  type LocationScope,
  venueRowFromDb,
} from '@/lib/diningVenues';
import { takePendingDiningMapPick } from '@/lib/pendingDiningMapPick';
import { deleteDiningMapSnapshotFile, downloadDiningMapSnapshotToCache } from '@/lib/diningVenueMapSnapshot';

const VENUE_TYPES: VenueType[] = ['restaurant', 'cafe', 'buffet'];
const SCOPES: LocationScope[] = ['on_premises', 'off_premises'];
/** Yeterli kontrast: tek başına placeholder rengi soluk kalmesin. */
const PLACEHOLDER = '#64748b';
const ph = { placeholderTextColor: PLACEHOLDER } as const;

type MenuDraft = DiningMenuItem & { _localImageUri?: string | null };

export default function AdminDiningVenueEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const base = pathname?.startsWith('/staff') ? '/staff/dining-venues' : '/admin/dining-venues';
  const staff = useAuthStore((s) => s.staff);
  const can = canManageDiningVenues(staff);

  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [venueType, setVenueType] = useState<VenueType>('restaurant');
  const [description, setDescription] = useState('');
  const [cuisineText, setCuisineText] = useState('');
  const [priceLevel, setPriceLevel] = useState<1 | 2 | 3>(2);
  const [images, setImages] = useState<string[]>([]);
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [mapSnapshotLocalUri, setMapSnapshotLocalUri] = useState<string | null>(null);
  const [coverIndex, setCoverIndex] = useState(0);
  const mapPickPhotoRef = useRef({ map: null as string | null, img: 0, loc: 0 });
  mapPickPhotoRef.current = { map: mapSnapshotLocalUri, img: images.length, loc: localUris.length };
  const [address, setAddress] = useState('');
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [scope, setScope] = useState<LocationScope>('off_premises');
  const [isOpenNow, setIsOpenNow] = useState(true);
  const [directions, setDirections] = useState('');
  const [reservation, setReservation] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [menu, setMenu] = useState<MenuDraft[]>([]);
  const [logoServerUrl, setLogoServerUrl] = useState<string | null>(null);
  const [logoLocalUri, setLogoLocalUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || id === 'new' || !staff?.organization_id) return;
    const { data, error } = await supabase.from('dining_venues').select('*').eq('id', id).single();
    if (error || !data) {
      Alert.alert(t('error'), t('diningVenuesLoadError'));
      return;
    }
    const v = venueRowFromDb(data as Record<string, unknown>);
    setName(v.name);
    setVenueType(v.venue_type);
    setDescription(v.description ?? '');
    setCuisineText((v.cuisine_tags ?? []).join(', '));
    setPriceLevel(Math.min(3, Math.max(1, v.price_level)) as 1 | 2 | 3);
    setImages(v.images ?? []);
    setAddress(v.address ?? '');
    setLatText(v.lat != null ? String(v.lat) : '');
    setLngText(v.lng != null ? String(v.lng) : '');
    setPhone(v.phone ?? '');
    setOpeningHours(v.opening_hours ?? '');
    setScope(v.location_scope);
    setIsOpenNow(v.is_open_now);
    setDirections(v.directions_text ?? '');
    setReservation(v.reservation_info ?? '');
    setIsActive(v.is_active);
    setMenu(v.menu_items.map((m) => ({ ...m })));
    setLogoServerUrl(v.logo_url?.trim() || null);
    setLogoLocalUri(null);
    setMapSnapshotLocalUri(null);
    const im = v.images ?? [];
    const cov = v.cover_image;
    if (cov && im.includes(cov)) setCoverIndex(im.indexOf(cov));
    else setCoverIndex(0);
  }, [id, staff?.organization_id, t]);

  useEffect(() => {
    (async () => {
      if (id && id !== 'new') {
        setLoading(true);
        await load();
        setLoading(false);
      }
    })();
  }, [id, load]);

  useEffect(() => {
    const n = images.length + localUris.length + (mapSnapshotLocalUri ? 1 : 0);
    if (n <= 0) return;
    setCoverIndex((c) => Math.min(c, n - 1));
  }, [images.length, localUris.length, mapSnapshotLocalUri]);

  useFocusEffect(
    useCallback(() => {
      const r = takePendingDiningMapPick();
      if (!r) return;
      setLatText(String(r.lat));
      setLngText(String(r.lng));
      setAddress(r.address);
      void (async () => {
        const { map, img, loc } = mapPickPhotoRef.current;
        const total = (map ? 1 : 0) + img + loc;
        if (total >= 10 && !map) {
          Alert.alert(t('error'), t('diningVenuesMapSnapshotNoRoom'));
          return;
        }
        const uri = await downloadDiningMapSnapshotToCache(r.lat, r.lng);
        if (uri) {
          setMapSnapshotLocalUri((prev) => {
            if (prev) void deleteDiningMapSnapshotFile(prev);
            return uri;
          });
          setCoverIndex(0);
        }
      })();
    }, [t])
  );

  const pickLogo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets[0]?.uri) return;
    setLogoLocalUri(res.assets[0].uri);
  };

  const pickGallery = async () => {
    const n = images.length + localUris.length + (mapSnapshotLocalUri ? 1 : 0);
    if (n >= 10) {
      Alert.alert(t('error'), t('diningVenuesMaxPhotos'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
    if (res.canceled) return;
    const next = res.assets.map((a) => a.uri).filter(Boolean) as string[];
    const cap = 10 - n;
    setLocalUris((u) => [...u, ...next.slice(0, cap)]);
  };

  const addMenuRow = () => {
    setMenu((m) => [...m, { name: '', description: '', price: null, image_url: null, _localImageUri: null }]);
  };

  const updateMenu = (i: number, patch: Partial<MenuDraft>) => {
    setMenu((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const pickMenuImage = async (i: number) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled || !res.assets[0]?.uri) return;
    updateMenu(i, { _localImageUri: res.assets[0].uri, image_url: null });
  };

  const save = async () => {
    if (!can || !staff?.organization_id) return;
    const title = name.trim();
    if (!title) {
      Alert.alert(t('error'), t('required'));
      return;
    }
    const nImg = images.length + localUris.length + (mapSnapshotLocalUri ? 1 : 0);
    if (nImg < 1) {
      Alert.alert(t('error'), t('diningVenuesMinPhotos'));
      return;
    }
    const lat = latText.trim() ? parseFloat(latText.replace(',', '.')) : null;
    const lng = lngText.trim() ? parseFloat(lngText.replace(',', '.')) : null;
    if (lat != null && !Number.isFinite(lat)) {
      Alert.alert(t('error'), t('diningVenuesLatInvalid'));
      return;
    }
    if (lng != null && !Number.isFinite(lng)) {
      Alert.alert(t('error'), t('diningVenuesLngInvalid'));
      return;
    }
    const cuisine_tags = cuisineText
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const baseRow = {
        organization_id: staff.organization_id,
        name: title,
        venue_type: venueType,
        description: description.trim() || null,
        cuisine_tags,
        price_level: priceLevel,
        address: address.trim() || null,
        lat,
        lng,
        phone: phone.trim() || null,
        opening_hours: openingHours.trim() || null,
        location_scope: scope,
        is_open_now: isOpenNow,
        directions_text: directions.trim() || null,
        reservation_info: reservation.trim() || null,
        is_active: isActive,
        created_by_staff_id: staff.id,
      };
      let vid = id !== 'new' ? id : '';
      if (id === 'new') {
        const ins = await supabase
          .from('dining_venues')
          .insert({
            ...baseRow,
            images: [] as string[],
            cover_image: null as string | null,
            logo_url: null as string | null,
            menu_items: [] as unknown[],
          })
          .select('id')
          .single();
        if (ins.error || !ins.data) {
          Alert.alert(t('error'), ins.error?.message ?? 'insert');
          return;
        }
        vid = (ins.data as { id: string }).id;
      } else {
        const { created_by_staff_id: _cb, ...updateRow } = baseRow;
        const upRes = await supabase
          .from('dining_venues')
          .update(updateRow as Record<string, unknown>)
          .eq('id', id);
        if (upRes.error) {
          Alert.alert(t('error'), upRes.error.message);
          return;
        }
      }
      const uploaded: string[] = [];
      if (mapSnapshotLocalUri) {
        const mapUrl = await uploadDiningVenueImage({
          organizationId: staff.organization_id,
          venueId: vid,
          localUri: mapSnapshotLocalUri,
          fileName: `map_loc_${Date.now()}.png`,
        });
        uploaded.push(mapUrl);
        void deleteDiningMapSnapshotFile(mapSnapshotLocalUri);
      }
      uploaded.push(...images);
      for (let i = 0; i < localUris.length; i++) {
        const uri = localUris[i];
        const url = await uploadDiningVenueImage({
          organizationId: staff.organization_id,
          venueId: vid,
          localUri: uri,
          fileName: `v_${Date.now()}_${i}.jpg`,
        });
        uploaded.push(url);
      }
      const cover = uploaded[Math.min(coverIndex, uploaded.length - 1)] ?? uploaded[0];
      const finalMenu: DiningMenuItem[] = [];
      for (let i = 0; i < menu.length; i++) {
        const row = menu[i];
        const nm = row.name.trim();
        if (!nm) continue;
        let imgUrl = row.image_url;
        if (row._localImageUri) {
          imgUrl = await uploadDiningVenueImage({
            organizationId: staff.organization_id,
            venueId: vid,
            localUri: row._localImageUri,
            fileName: `menu_${i}_${Date.now()}.jpg`,
          });
        }
        const pr = row.price != null && String(row.price).trim() ? parseFloat(String(row.price).replace(',', '.')) : null;
        finalMenu.push({
          name: nm,
          description: row.description?.trim() || null,
          price: pr != null && Number.isFinite(pr) ? pr : null,
          image_url: imgUrl || null,
        });
      }
      let finalLogo: string | null = logoServerUrl;
      if (logoLocalUri) {
        finalLogo = await uploadDiningVenueImage({
          organizationId: staff.organization_id,
          venueId: vid,
          localUri: logoLocalUri,
          fileName: `logo_${Date.now()}.jpg`,
        });
      }
      const fin = await supabase
        .from('dining_venues')
        .update({ images: uploaded, cover_image: cover, menu_items: finalMenu, logo_url: finalLogo })
        .eq('id', vid);
      if (fin.error) Alert.alert(t('error'), fin.error.message);
      else {
        setLocalUris([]);
        setMapSnapshotLocalUri(null);
        setImages(uploaded);
        setMenu(finalMenu);
        setLogoLocalUri(null);
        setLogoServerUrl(finalLogo);
        router.replace((base + '/') as Href);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteVenue = () => {
    if (!can || id === 'new' || !id) return;
    Alert.alert(t('diningVenuesDelete'), t('diningVenuesDeleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('dining_venues').delete().eq('id', id);
          if (error) Alert.alert(t('error'), error.message);
          else router.replace((base + '/') as Href);
        },
      },
    ]);
  };

  if (!can) {
    return (
      <View style={styles.center}>
        <Text>{t('diningVenuesNoAccess')}</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={adminTheme.colors.primary} />
      </View>
    );
  }

  const totalPhotos = (mapSnapshotLocalUri ? 1 : 0) + images.length + localUris.length;
  const allPhotoUrls: string[] = [
    ...(mapSnapshotLocalUri ? [mapSnapshotLocalUri] : []),
    ...images,
    ...localUris,
  ];
  const logoPreviewUri = logoLocalUri || logoServerUrl;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: adminTheme.colors.surfaceTertiary }}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.pageHead}>
        <Text style={styles.pageTitle}>
          {id === 'new' ? t('diningVenuesAdd') : t('diningVenuesFormTitle')}
        </Text>
        <Text style={styles.intro}>{t('diningVenuesEditorIntro')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="information-circle-outline" size={22} color={adminTheme.colors.accent} />
          <Text style={styles.cardTitle}>{t('diningVenuesSectionGeneral')}</Text>
        </View>
        <Text style={[styles.label, { marginTop: 4 }]}>
          <Text style={styles.req}>* </Text>
          {t('diningVenuesFieldName')}
        </Text>
        <TextInput
          style={styles.in}
          value={name}
          onChangeText={setName}
          {...ph}
          placeholder={t('diningVenuesFieldName')}
        />
        <Text style={styles.label}>{t('diningVenuesFieldType')}</Text>
        <View style={styles.chips}>
          {VENUE_TYPES.map((vt) => (
            <TouchableOpacity
              key={vt}
              onPress={() => setVenueType(vt)}
              style={[styles.chip, venueType === vt && styles.chipOn]}
            >
              <Text style={[styles.chipT, venueType === vt && styles.chipTOn]}>{t(`diningVenuesType_${vt}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>{t('diningVenuesFieldDescription')}</Text>
        <TextInput
          style={[styles.in, { minHeight: 96 }]}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          {...ph}
          placeholder={t('diningVenuesFieldDescription')}
        />
        <Text style={styles.label}>{t('diningVenuesFieldCuisine')}</Text>
        <TextInput
          style={styles.in}
          value={cuisineText}
          onChangeText={setCuisineText}
          placeholder={t('diningVenuesCuisinePh')}
          {...ph}
        />
        <Text style={styles.label}>{t('diningVenuesFieldPrice')}</Text>
        <View style={styles.chips}>
          {([1, 2, 3] as const).map((p) => (
            <TouchableOpacity key={p} onPress={() => setPriceLevel(p)} style={[styles.chip, priceLevel === p && styles.chipOn]}>
              <Text style={[styles.chipT, priceLevel === p && styles.chipTOn]}>{'₺'.repeat(p)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="images-outline" size={22} color={adminTheme.colors.accent} />
          <Text style={styles.cardTitle}>{t('diningVenuesSectionBranding')}</Text>
        </View>
        <Text style={styles.label}>{t('diningVenuesFieldLogo')}</Text>
        <Text style={styles.hintText}>{t('diningVenuesFieldLogoHint')}</Text>
        <View style={styles.logoRow}>
          <View style={styles.logoPreviewWrap}>
            {!logoPreviewUri ? (
              <Ionicons name="business" size={40} color={adminTheme.colors.textMuted} />
            ) : logoPreviewUri.startsWith('http') ? (
              <CachedImage uri={logoPreviewUri} style={styles.logoPreview} contentFit="cover" />
            ) : (
              <Image source={{ uri: logoPreviewUri }} style={styles.logoPreview} />
            )}
          </View>
          <View style={styles.logoActions}>
            <TouchableOpacity style={styles.smallPickBtn} onPress={pickLogo} activeOpacity={0.9}>
              <Text style={styles.smallPickBtnT}>{t('diningVenuesLogoUpload')}</Text>
            </TouchableOpacity>
            {logoPreviewUri ? (
              <TouchableOpacity
                onPress={() => {
                  setLogoLocalUri(null);
                  setLogoServerUrl(null);
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.removeLogoT}>{t('diningVenuesMenuRemove')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('diningVenuesFieldActiveList')}</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: '#cbd5e1', true: adminTheme.colors.accent }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('diningVenuesFieldOpenNow')}</Text>
          <Switch value={isOpenNow} onValueChange={setIsOpenNow} trackColor={{ false: '#cbd5e1', true: adminTheme.colors.accent }} />
        </View>
        <Text style={styles.label}>
          <Text style={styles.req}>* </Text>
          {t('diningVenuesFieldPhotos')}
        </Text>
        <Text style={styles.hintText}>
          {t('diningVenuesPhotoHint', { n: totalPhotos })}
          {totalPhotos > 0 ? ` — ${t('diningVenuesTapCover')}` : ''}
        </Text>
        <TouchableOpacity style={styles.pickBtn} onPress={pickGallery} activeOpacity={0.88}>
          <Ionicons name="images" size={18} color={adminTheme.colors.primary} />
          <Text style={styles.pickBtnT}>{t('diningVenuesAddPhoto')}</Text>
        </TouchableOpacity>
        {allPhotoUrls.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 10 }}>
            {allPhotoUrls.map((uri, i) => (
              <TouchableOpacity key={`${uri}-${i}`} onPress={() => setCoverIndex(i)} activeOpacity={0.9}>
                {uri.startsWith('http') ? (
                  <CachedImage uri={uri} style={styles.thumb} contentFit="cover" />
                ) : (
                  <Image source={{ uri }} style={styles.thumb} />
                )}
                {coverIndex === i ? (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeT}>{t('diningVenuesCover')}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="location-outline" size={22} color={adminTheme.colors.accent} />
          <Text style={styles.cardTitle}>{t('diningVenuesSectionLocation')}</Text>
        </View>
        <Text style={styles.label}>{t('diningVenuesFieldAddress')}</Text>
        <TextInput
          style={styles.in}
          value={address}
          onChangeText={setAddress}
          {...ph}
          placeholder={t('diningVenuesFieldAddress')}
        />
        <Text style={styles.hintText}>{t('diningVenuesMapSnapshotHint')}</Text>
        <TouchableOpacity
          style={styles.mapPickBtn}
          onPress={() =>
            router.push({
              pathname: `${base}/pick-location`,
              params: {
                lat: latText.trim() || '',
                lng: lngText.trim() || '',
              },
            })
          }
          activeOpacity={0.88}
        >
          <Ionicons name="location" size={24} color={adminTheme.colors.primary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.mapPickBtnT}>{t('diningVenuesRestaurantLocation')}</Text>
            <Text style={styles.mapPickSub} numberOfLines={2}>
              {t('diningVenuesPickOnMap')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={adminTheme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.label}>{t('diningVenuesFieldLatLng')}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            style={[styles.in, { flex: 1 }]}
            value={latText}
            onChangeText={setLatText}
            placeholder="41.0082"
            keyboardType="decimal-pad"
            {...ph}
          />
          <TextInput
            style={[styles.in, { flex: 1 }]}
            value={lngText}
            onChangeText={setLngText}
            placeholder="28.9784"
            keyboardType="decimal-pad"
            {...ph}
          />
        </View>
        <Text style={styles.label}>{t('diningVenuesFieldPhone')}</Text>
        <TextInput
          style={styles.in}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          {...ph}
          placeholder="+90 5xx xxx xx xx"
        />
        <Text style={styles.label}>{t('diningVenuesFieldHours')}</Text>
        <TextInput
          style={styles.in}
          value={openingHours}
          onChangeText={setOpeningHours}
          placeholder="09:00 – 23:00"
          {...ph}
        />
        <Text style={styles.label}>{t('diningVenuesFieldLocationScope')}</Text>
        <View style={styles.chips}>
          {SCOPES.map((s) => (
            <TouchableOpacity key={s} onPress={() => setScope(s)} style={[styles.chip, scope === s && styles.chipOn]}>
              <Text style={[styles.chipT, scope === s && styles.chipTOn]}>{t(`diningVenuesScope_${s}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="navigate-circle-outline" size={22} color={adminTheme.colors.accent} />
          <Text style={styles.cardTitle}>{t('diningVenuesSectionExtra')}</Text>
        </View>
        <Text style={styles.label}>{t('diningVenuesFieldDirections')}</Text>
        <TextInput
          style={[styles.in, { minHeight: 72 }]}
          value={directions}
          onChangeText={setDirections}
          multiline
          textAlignVertical="top"
          {...ph}
          placeholder={t('diningVenuesFieldDirections')}
        />
        <Text style={styles.label}>{t('diningVenuesFieldReservation')}</Text>
        <TextInput
          style={[styles.in, { minHeight: 72 }]}
          value={reservation}
          onChangeText={setReservation}
          multiline
          textAlignVertical="top"
          {...ph}
          placeholder={t('diningVenuesFieldReservation')}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="restaurant-outline" size={22} color={adminTheme.colors.accent} />
          <Text style={styles.cardTitle}>{t('diningVenuesMenuSection')}</Text>
        </View>
        {menu.map((m, i) => {
          return (
            <View key={i} style={styles.menuBox}>
              <Text style={styles.menuFieldLabel}>{t('diningVenuesMenuName')}</Text>
              <TextInput
                style={styles.in}
                value={m.name}
                onChangeText={(x) => updateMenu(i, { name: x })}
                placeholder={t('diningVenuesMenuName')}
                {...ph}
              />
              <Text style={styles.menuFieldLabel}>{t('diningVenuesMenuDescPh')}</Text>
              <TextInput
                style={[styles.in, { minHeight: 56 }]}
                value={m.description ?? ''}
                onChangeText={(x) => updateMenu(i, { description: x })}
                placeholder={t('diningVenuesMenuDescPh')}
                multiline
                textAlignVertical="top"
                {...ph}
              />
              <Text style={styles.menuFieldLabel}>
                {t('diningVenuesFieldPrice')} (₺)
              </Text>
              <TextInput
                style={styles.in}
                value={m.price != null ? String(m.price) : ''}
                onChangeText={(x) => updateMenu(i, { price: x ? parseFloat(x.replace(',', '.')) : null })}
                placeholder="199"
                keyboardType="decimal-pad"
                {...ph}
              />
              <View style={styles.menuRow}>
                <TouchableOpacity style={styles.smallBtn} onPress={() => pickMenuImage(i)}>
                  <Text style={styles.smallBtnT}>{t('diningVenuesMenuPickImage')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() => setMenu((rows) => rows.filter((_, j) => j !== i))}
                >
                  <Text style={[styles.smallBtnT, { color: adminTheme.colors.error }]}>{t('diningVenuesMenuRemove')}</Text>
                </TouchableOpacity>
              </View>
              {m._localImageUri ? (
                <Image source={{ uri: m._localImageUri }} style={styles.menuPrev} />
              ) : m.image_url ? (
                <CachedImage uri={m.image_url} style={styles.menuPrev} contentFit="cover" />
              ) : null}
            </View>
          );
        })}
        <TouchableOpacity style={styles.pickBtn} onPress={addMenuRow} activeOpacity={0.88}>
          <Ionicons name="add-circle-outline" size={20} color={adminTheme.colors.primary} />
          <Text style={styles.pickBtnT}>{t('diningVenuesMenuAdd')}</Text>
        </TouchableOpacity>
      </View>

      {id !== 'new' ? (
        <TouchableOpacity style={styles.delBtn} onPress={deleteVenue}>
          <Text style={styles.delBtnT}>{t('diningVenuesDeleteThis')}</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        onPress={save}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnT}>{t('submit')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
  default: {},
});

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 56, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageHead: { marginBottom: 6 },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: adminTheme.colors.text,
    letterSpacing: -0.4,
  },
  intro: { fontSize: 15, lineHeight: 22, color: '#475569', marginTop: 10 },
  card: {
    backgroundColor: adminTheme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    ...cardShadow,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: adminTheme.colors.borderLight,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: adminTheme.colors.text, flex: 1 },
  label: { fontSize: 15, fontWeight: '700', color: adminTheme.colors.text, marginTop: 12, marginBottom: 6 },
  req: { color: adminTheme.colors.error },
  hintText: { fontSize: 13, lineHeight: 19, color: '#64748b', marginBottom: 6, marginTop: 2 },
  menuFieldLabel: { fontSize: 14, fontWeight: '700', color: adminTheme.colors.text, marginTop: 8, marginBottom: 4 },
  in: {
    backgroundColor: adminTheme.colors.surfaceTertiary,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: adminTheme.colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingVertical: 6,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: adminTheme.colors.text, flex: 1, paddingRight: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4, marginTop: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: adminTheme.colors.surfaceTertiary,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  chipOn: { backgroundColor: adminTheme.colors.primary, borderColor: adminTheme.colors.primary },
  chipT: { fontWeight: '700', color: '#334155', fontSize: 14 },
  chipTOn: { color: '#fff' },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: adminTheme.colors.surfaceTertiary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: adminTheme.colors.border,
    marginTop: 6,
  },
  pickBtnT: { fontWeight: '800', color: adminTheme.colors.primary, fontSize: 15 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, marginBottom: 6 },
  logoPreviewWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: adminTheme.colors.surface,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPreview: { width: 88, height: 88, borderRadius: 44 },
  logoActions: { flex: 1, gap: 6 },
  smallPickBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: adminTheme.colors.surface, borderWidth: 1, borderColor: adminTheme.colors.border },
  smallPickBtnT: { fontWeight: '800', color: adminTheme.colors.primary, fontSize: 14 },
  removeLogoT: { color: adminTheme.colors.error, fontWeight: '700', fontSize: 14, marginTop: 2 },
  mapPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: adminTheme.colors.primary,
    backgroundColor: adminTheme.colors.surfaceTertiary,
  },
  mapPickBtnT: { fontWeight: '800', color: adminTheme.colors.text, fontSize: 16 },
  mapPickSub: { fontSize: 13, color: '#64748b', marginTop: 3, lineHeight: 18 },
  thumb: { width: 88, height: 88, borderRadius: 10, borderWidth: 1, borderColor: adminTheme.colors.border },
  coverBadge: { position: 'absolute', bottom: 4, left: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingVertical: 2, alignItems: 'center' },
  coverBadgeT: { color: '#fff', fontSize: 10, fontWeight: '800' },
  menuBox: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: adminTheme.colors.surfaceTertiary,
  },
  menuRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  smallBtn: { paddingVertical: 6 },
  smallBtnT: { fontWeight: '700', color: adminTheme.colors.primary, fontSize: 14 },
  menuPrev: { width: 80, height: 80, borderRadius: 8, marginTop: 6 },
  delBtn: { marginTop: 8, marginBottom: 8, padding: 12, alignItems: 'center' },
  delBtnT: { color: adminTheme.colors.error, fontWeight: '800' },
  saveBtn: {
    backgroundColor: adminTheme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  saveBtnT: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
