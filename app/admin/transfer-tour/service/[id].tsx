import { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, usePathname, type Href } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { adminTheme } from '@/constants/adminTheme';
import { CachedImage } from '@/components/CachedImage';
import { canManageTransferServices } from '@/lib/transferTourPermissions';
import { uploadTransferTourImage, uploadTransferTourOperatorLogo } from '@/lib/transferTourUpload';
import { takePendingTransferTourMapPick } from '@/lib/pendingTransferTourMapPick';
import { HOTEL_LAT, HOTEL_LON } from '@/lib/diningVenueMapHelpers';
import {
  type TransferServiceType,
  type VehicleSize,
  type PricingType,
  type AvailabilityStatus,
  type RouteLeg,
  type I18nJson,
  PRICING_TYPES,
  VEHICLE_SIZES,
  TRANSFER_SERVICE_TYPES,
  AVAILABILITY,
  serviceRowFromDb,
  parseRoutes,
  buildTurkishContentI18n,
  firstTextFromI18n,
  DEFAULT_TRANSFER_SERVICE_ROUTE_FROM_TR,
  DEFAULT_TRANSFER_SERVICE_ROUTE_TO_TR,
} from '@/lib/transferTour';

const TYPES: TransferServiceType[] = [...TRANSFER_SERVICE_TYPES];
const SIZES: VehicleSize[] = [...VEHICLE_SIZES];

const TYPE_TKEY: Record<TransferServiceType, string> = {
  transfer: 'transferTourTypeTransfer',
  tour: 'transferTourTypeTour',
  vip: 'transferTourTypeVip',
  custom_route: 'transferTourTypeCustomRoute',
};
const SIZE_TKEY: Record<VehicleSize, string> = {
  small: 'transferTourSizeSmall',
  medium: 'transferTourSizeMedium',
  large: 'transferTourSizeLarge',
  vip: 'transferTourSizeVip',
};
const PRICE_TKEY: Record<PricingType, string> = {
  fixed: 'transferTourPriceFixed',
  per_person: 'transferTourPricePerPerson',
  quote: 'transferTourPriceQuote',
};
const AV_TKEY: Record<AvailabilityStatus, string> = {
  available: 'transferTourAvAvailable',
  limited: 'transferTourAvLimited',
  on_request: 'transferTourAvOnRequest',
};

export default function TransferTourServiceEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const staff = useAuthStore((s) => s.staff);
  const router = useRouter();
  const pathname = usePathname();
  const base = pathname?.startsWith('/staff') ? '/staff/transfer-tour' : '/admin/transfer-tour';
  const can = canManageTransferServices(staff) || staff?.role === 'admin';

  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [titleText, setTitleText] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [serviceType, setServiceType] = useState<TransferServiceType>('transfer');
  const [vehicleSize, setVehicleSize] = useState<VehicleSize>('medium');
  const [pricingType, setPricingType] = useState<PricingType>('fixed');
  const [availability, setAvailability] = useState<AvailabilityStatus>('available');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [luggageCapacity, setLuggageCapacity] = useState('2');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [tourOperatorName, setTourOperatorName] = useState('');
  const [tourOperatorLogoUrl, setTourOperatorLogoUrl] = useState<string | null>(null);
  const [operatorLogoLocal, setOperatorLogoLocal] = useState<string | null>(null);
  const [removeOperatorLogo, setRemoveOperatorLogo] = useState(false);
  const [mapLatText, setMapLatText] = useState('');
  const [mapLngText, setMapLngText] = useState('');
  const [mapAddress, setMapAddress] = useState('');
  const [coverIndex, setCoverIndex] = useState(0);
  const [feat, setFeat] = useState<Record<string, boolean>>({
    air_conditioning: true,
    wifi: false,
    child_seat: false,
    driver_included: true,
    non_smoking: false,
    vip: false,
    luggage: true,
  });

  const load = useCallback(async () => {
    if (!id || id === 'new' || !staff?.organization_id) return;
    const { data, error } = await supabase.from('transfer_services').select('*').eq('id', id).single();
    if (error || !data) {
      Alert.alert(t('error'), t('transferTourErrorDetail'));
      return;
    }
    const s = serviceRowFromDb({ ...(data as object), routes: parseRoutes((data as { routes?: unknown }).routes) });
    setTitleText(firstTextFromI18n(s.title as I18nJson));
    setDescriptionText(firstTextFromI18n(s.description as I18nJson));
    setServiceType(s.service_type);
    setVehicleSize(s.vehicle_size);
    setPricingType(s.pricing_type);
    setAvailability(s.availability_status);
    setBrand(s.brand ?? '');
    setModel(s.model ?? '');
    setYear(s.year != null ? String(s.year) : '');
    setCapacity(String(s.capacity));
    setLuggageCapacity(String(s.luggage_capacity));
    setPrice(s.price != null ? String(s.price) : '');
    setCurrency(s.currency);
    setIsActive(s.is_active);
    setImages(s.images ?? []);
    setTourOperatorName(s.tour_operator_name ?? '');
    setTourOperatorLogoUrl(s.tour_operator_logo ?? null);
    setOperatorLogoLocal(null);
    setRemoveOperatorLogo(false);
    setMapLatText(s.map_lat != null ? String(s.map_lat) : '');
    setMapLngText(s.map_lng != null ? String(s.map_lng) : '');
    setMapAddress(s.map_address ?? '');
    const r0 = s.routes[0];
    if (r0) {
      setDistance(r0.distance_km != null ? String(r0.distance_km) : '');
      setDuration(r0.duration_min != null ? String(r0.duration_min) : '');
    }
    const defaultKeys: Record<string, boolean> = {
      air_conditioning: true,
      wifi: false,
      child_seat: false,
      driver_included: true,
      non_smoking: false,
      vip: false,
      luggage: true,
    };
    const fi: Record<string, boolean> = { ...defaultKeys };
    for (const k of Object.keys(fi)) fi[k] = (s.features ?? []).includes(k);
    setFeat(fi);
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
    const n = images.length + localUris.length;
    if (n <= 0) return;
    setCoverIndex((c) => Math.min(c, n - 1));
  }, [images.length, localUris.length]);

  useFocusEffect(
    useCallback(() => {
      const r = takePendingTransferTourMapPick();
      if (!r) return;
      setMapLatText(String(r.lat));
      setMapLngText(String(r.lng));
      setMapAddress(r.address);
    }, [])
  );

  const openMapPicker = () => {
    const la = mapLatText.trim() ? parseFloat(mapLatText.replace(',', '.')) : NaN;
    const ln = mapLngText.trim() ? parseFloat(mapLngText.replace(',', '.')) : NaN;
    const has = Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180;
    const q = has
      ? `?lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}`
      : `?lat=${encodeURIComponent(String(HOTEL_LAT))}&lng=${encodeURIComponent(String(HOTEL_LON))}`;
    router.push((`${base}/pick-location` + q) as Href);
  };

  const pickOperatorLogo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets[0]?.uri) return;
    setRemoveOperatorLogo(false);
    setOperatorLogoLocal(res.assets[0].uri);
  };

  const pickImages = async () => {
    const n = images.length + localUris.length;
    if (n >= 10) {
      Alert.alert(t('error'), t('transferTourMaxPhotos'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
    if (res.canceled) return;
    const next = res.assets.map((a) => a.uri).filter(Boolean) as string[];
    const cap = 10 - n;
    setLocalUris((u) => [...u, ...next.slice(0, cap)]);
  };

  const deleteThisService = () => {
    if (!can || id === 'new' || !id) return;
    Alert.alert(t('transferTourDeleteOnEdit'), t('transferTourDeleteOnEditConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('transferTourDelete'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('transfer_services').delete().eq('id', id);
          if (error) Alert.alert(t('error'), error.message);
          else router.replace((base + '/') as Href);
        },
      },
    ]);
  };

  const save = async () => {
    if (!can || !staff?.organization_id) return;
    if (!titleText.trim()) {
      Alert.alert(t('error'), t('required'));
      return;
    }
    const nImages = images.length + localUris.length;
    if (nImages < 1) {
      Alert.alert(t('error'), t('transferTourMinPhotos'));
      return;
    }
    const mLat = mapLatText.trim() ? parseFloat(mapLatText.replace(',', '.')) : null;
    const mLng = mapLngText.trim() ? parseFloat(mapLngText.replace(',', '.')) : null;
    if (mLat != null && !Number.isFinite(mLat)) {
      Alert.alert(t('error'), t('diningVenuesLatInvalid'));
      return;
    }
    if (mLng != null && !Number.isFinite(mLng)) {
      Alert.alert(t('error'), t('diningVenuesLngInvalid'));
      return;
    }
    if ((mLat == null) !== (mLng == null)) {
      Alert.alert(t('error'), t('transferTourMapCoordPair'));
      return;
    }
    setSaving(true);
    try {
      const routes: RouteLeg[] = [
        {
          from: buildTurkishContentI18n(DEFAULT_TRANSFER_SERVICE_ROUTE_FROM_TR),
          to: buildTurkishContentI18n(DEFAULT_TRANSFER_SERVICE_ROUTE_TO_TR),
          distance_km: distance ? parseFloat(distance.replace(',', '.')) : null,
          duration_min: duration ? parseInt(duration, 10) : null,
          price: price ? parseFloat(price.replace(',', '.')) : null,
        },
      ];
      const titleI18n = buildTurkishContentI18n(titleText);
      const descI18n = buildTurkishContentI18n(descriptionText);
      const featureList = Object.entries(feat).filter(([, v]) => v).map(([k]) => k);
      let tourOperatorLogoRemote: string | null;
      if (removeOperatorLogo) {
        tourOperatorLogoRemote = null;
      } else if (operatorLogoLocal) {
        tourOperatorLogoRemote = null;
      } else {
        tourOperatorLogoRemote = tourOperatorLogoUrl;
      }
      const payload = {
        organization_id: staff.organization_id,
        service_type: serviceType,
        title: titleI18n,
        description: descI18n,
        brand: brand || null,
        model: model || null,
        year: year ? parseInt(year, 10) : null,
        vehicle_size: vehicleSize,
        capacity: parseInt(capacity, 10) || 1,
        luggage_capacity: parseInt(luggageCapacity, 10) || 0,
        routes,
        pricing_type: pricingType,
        price: pricingType === 'quote' ? null : price ? parseFloat(price.replace(',', '.')) : null,
        currency,
        features: featureList,
        is_active: isActive,
        availability_status: availability,
        images: images,
        cover_image: null as string | null,
        created_by_staff_id: staff.id,
        tour_operator_name: tourOperatorName.trim() || null,
        tour_operator_logo: tourOperatorLogoRemote,
        map_lat: mLat,
        map_lng: mLng,
        map_address: mapAddress.trim() || null,
      };
      let sid = id !== 'new' ? id : '';
      if (id === 'new') {
        const ins = await supabase.from('transfer_services').insert({ ...payload, images: [] }).select('id').single();
        if (ins.error || !ins.data) {
          Alert.alert(t('error'), ins.error?.message ?? 'insert');
          return;
        }
        sid = (ins.data as { id: string }).id;
      } else {
        const { created_by_staff_id: _c, ...upPayload } = payload;
        const up = await supabase.from('transfer_services').update(upPayload as Record<string, unknown>).eq('id', id);
        if (up.error) {
          Alert.alert(t('error'), up.error.message);
          return;
        }
      }
      const uploaded: string[] = [...images];
      for (let i = 0; i < localUris.length; i++) {
        const uri = localUris[i];
        const url = await uploadTransferTourImage({
          organizationId: staff.organization_id,
          serviceId: sid,
          localUri: uri,
          fileName: `img_${Date.now()}_${i}.jpg`,
        });
        uploaded.push(url);
      }
      const cover = uploaded[Math.min(coverIndex, uploaded.length - 1)] ?? uploaded[0];
      let finalOperatorLogo: string | null;
      if (operatorLogoLocal) {
        finalOperatorLogo = await uploadTransferTourOperatorLogo({
          organizationId: staff.organization_id,
          serviceId: sid,
          localUri: operatorLogoLocal,
          fileName: `operator_${Date.now()}.jpg`,
        });
      } else if (removeOperatorLogo) {
        finalOperatorLogo = null;
      } else {
        finalOperatorLogo = tourOperatorLogoUrl;
      }
      const fin = await supabase
        .from('transfer_services')
        .update({
          images: uploaded,
          cover_image: cover,
          tour_operator_logo: finalOperatorLogo,
        })
        .eq('id', sid);
      if (fin.error) Alert.alert(t('error'), fin.error.message);
      else {
        setLocalUris([]);
        setImages(uploaded);
        router.replace((base + '/') as Href);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!can) {
    return (
      <View style={styles.center}>
        <Text>{t('transferTourNoAccess')}</Text>
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

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={{ flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary }}>
      <Text style={styles.h}>{t('transferTourEditService')}</Text>
      <Text style={styles.hint}>{t('transferTourContentTurkishOnly')}</Text>
      <Text style={styles.l}>{t('transferTourFieldTitle')}</Text>
      <TextInput style={styles.in} value={titleText} onChangeText={setTitleText} />
      <Text style={styles.l}>{t('transferTourFieldDescription')}</Text>
      <TextInput style={[styles.in, { minHeight: 72 }]} value={descriptionText} onChangeText={setDescriptionText} multiline textAlignVertical="top" />
      <Text style={styles.l}>{t('transferTourOperatorSection')}</Text>
      <Text style={styles.hintSmall}>{t('transferTourOperatorHint')}</Text>
      <TextInput
        style={styles.in}
        value={tourOperatorName}
        onChangeText={setTourOperatorName}
        placeholder={t('transferTourOperatorNamePh')}
        placeholderTextColor={adminTheme.colors.textMuted}
      />
      <Text style={styles.l}>{t('transferTourOperatorLogo')}</Text>
      <View style={styles.row}>
        {!removeOperatorLogo && operatorLogoLocal ? (
          <Image source={{ uri: operatorLogoLocal }} style={styles.opLogo} />
        ) : !removeOperatorLogo && tourOperatorLogoUrl ? (
          <CachedImage uri={tourOperatorLogoUrl} style={styles.opLogo} contentFit="cover" />
        ) : (
          <View style={[styles.opLogo, styles.opLogoPh]}>
            <Text style={styles.opLogoPhT}>—</Text>
          </View>
        )}
        <View style={styles.colGrow}>
          <TouchableOpacity style={styles.btnLine} onPress={pickOperatorLogo}>
            <Text style={styles.btnLineT}>{t('transferTourAddOperatorLogo')}</Text>
          </TouchableOpacity>
          {((tourOperatorLogoUrl || operatorLogoLocal) && !removeOperatorLogo) ? (
            <TouchableOpacity
              style={styles.btnLineDanger}
              onPress={() => {
                setRemoveOperatorLogo(true);
                setOperatorLogoLocal(null);
              }}
            >
              <Text style={styles.btnLineDangerT}>{t('transferTourRemoveLogo')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <Text style={styles.l}>{t('transferTourMapLocation')}</Text>
      <Text style={styles.hintSmall}>{t('transferTourMapHint')}</Text>
      <TouchableOpacity style={styles.mapPickBtn} onPress={openMapPicker}>
        <Text style={styles.mapPickBtnT}>{t('transferTourPickLocation')}</Text>
      </TouchableOpacity>
      {mapAddress ? <Text style={styles.mapAddr}>{mapAddress}</Text> : null}
      <View style={styles.mapCoordRow}>
        <Text style={styles.mapCoordL}>lat</Text>
        <TextInput style={styles.inFlex} value={mapLatText} onChangeText={setMapLatText} keyboardType="decimal-pad" placeholder="—" />
        <Text style={styles.mapCoordL}>lng</Text>
        <TextInput style={styles.inFlex} value={mapLngText} onChangeText={setMapLngText} keyboardType="decimal-pad" placeholder="—" />
      </View>
      {(mapLatText.trim() || mapLngText.trim() || mapAddress) ? (
        <TouchableOpacity
          style={styles.btnLine}
          onPress={() => {
            setMapLatText('');
            setMapLngText('');
            setMapAddress('');
          }}
        >
          <Text style={styles.btnLineT}>{t('transferTourRemoveMapPin')}</Text>
        </TouchableOpacity>
      ) : null}
      <TypePicker label={t('transferTourLabelServiceType')} value={serviceType} options={TYPES} onChange={setServiceType} tKey={(k) => TYPE_TKEY[k]} t={t} />
      <TypePicker
        label={t('transferTourLabelVehicleSize')}
        value={vehicleSize}
        options={SIZES}
        onChange={setVehicleSize}
        tKey={(k) => SIZE_TKEY[k]}
        t={t}
      />
      <Text style={styles.l}>{t('transferTourFieldBrand')} / {t('transferTourFieldModel')} / {t('transferTourFieldYear')}</Text>
      <TextInput style={styles.in} value={brand} onChangeText={setBrand} />
      <TextInput style={styles.in} value={model} onChangeText={setModel} />
      <TextInput style={styles.in} value={year} onChangeText={setYear} keyboardType="number-pad" />
      <Text style={styles.l}>{t('transferTourFieldCapacityShort')}</Text>
      <TextInput style={styles.in} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <TextInput style={styles.in} value={luggageCapacity} onChangeText={setLuggageCapacity} keyboardType="number-pad" />
      <TypePicker
        label={t('transferTourLabelPricing')}
        value={pricingType}
        options={[...PRICING_TYPES]}
        onChange={setPricingType}
        tKey={(k) => PRICE_TKEY[k]}
        t={t}
      />
      <TextInput style={styles.in} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Price" />
      <TextInput style={styles.in} value={currency} onChangeText={setCurrency} />
      <TypePicker
        label={t('transferTourLabelAvailability')}
        value={availability}
        options={[...AVAILABILITY]}
        onChange={setAvailability}
        tKey={(k) => AV_TKEY[k]}
        t={t}
      />
      <Text style={styles.l}>{t('transferTourFieldRouteKmMin')}</Text>
      <TextInput style={styles.in} value={distance} onChangeText={setDistance} keyboardType="decimal-pad" />
      <TextInput style={styles.in} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
      {(
        [
          ['air_conditioning', 'transferTourFeatureAc'],
          ['wifi', 'transferTourFeatureWifi'],
          ['child_seat', 'transferTourFeatureChildSeat'],
          ['driver_included', 'transferTourFeatureDriver'],
          ['non_smoking', 'transferTourFeatureNonSmoking'],
          ['vip', 'transferTourFeatureVip'],
          ['luggage', 'transferTourFeatureLuggage'],
        ] as const
      ).map(([k, lab]) => (
        <View key={k} style={styles.row}>
          <Text style={{ flex: 1 }}>{t(lab)}</Text>
          <Switch value={feat[k] ?? false} onValueChange={(x) => setFeat((f) => ({ ...f, [k]: x }))} />
        </View>
      ))}
      <View style={styles.row}>
        <Text style={{ flex: 1 }}>{t('transferTourActive')}</Text>
        <Switch value={isActive} onValueChange={setIsActive} />
      </View>
      <TouchableOpacity style={styles.addIm} onPress={pickImages}>
        <Text style={{ color: adminTheme.colors.primary, fontWeight: '700' }}>+ {t('transferTourAddService')} (foto)</Text>
      </TouchableOpacity>
      <Text style={styles.muted}>
        {t('transferTourPhotoCount', { n: images.length + localUris.length })}
      </Text>
      {images.length + localUris.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
          {[...images, ...localUris].map((uri, i) => {
            const isCover = i === coverIndex;
            return (
              <TouchableOpacity
                key={`${uri.slice(-40)}-${i}`}
                onPress={() => setCoverIndex(i)}
                style={[styles.thumbWrap, isCover && styles.thumbWrapOn]}
                activeOpacity={0.9}
              >
                {uri.startsWith('http') ? (
                  <CachedImage uri={uri} style={styles.thumb} contentFit="cover" />
                ) : (
                  <Image source={{ uri }} style={styles.thumb} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
      <View style={styles.row}>
        <Text style={styles.mutedSmall}>{t('transferTourCoverHint')}</Text>
      </View>
      <TouchableOpacity style={styles.save} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveT}>{t('transferTourSave')}</Text>}
      </TouchableOpacity>
      {id !== 'new' ? (
        <TouchableOpacity style={styles.danger} onPress={deleteThisService}>
          <Text style={styles.dangerT}>{t('transferTourDeleteOnEdit')}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function TypePicker<T extends string>({
  label,
  value,
  options,
  onChange,
  tKey,
  t,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
  tKey: (k: T) => string;
  t: (k: string) => string;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Text style={styles.l}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => (
          <TouchableOpacity
            key={o}
            onPress={() => onChange(o)}
            style={[
              { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: adminTheme.colors.border },
              value === o && { backgroundColor: adminTheme.colors.primary, borderColor: adminTheme.colors.primary },
            ]}
          >
            <Text style={value === o ? { color: '#fff', fontWeight: '700' } : {}}>{t(tKey(o))}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },
  h: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  hint: { fontSize: 13, color: adminTheme.colors.textSecondary, lineHeight: 19, marginBottom: 12 },
  hintSmall: { fontSize: 12, color: adminTheme.colors.textMuted, lineHeight: 18, marginBottom: 8 },
  l: { fontSize: 12, color: adminTheme.colors.textSecondary, marginBottom: 4, marginTop: 8, fontWeight: '600' },
  colGrow: { flex: 1, minWidth: 0 },
  opLogo: { width: 72, height: 72, borderRadius: 12, backgroundColor: adminTheme.colors.surface },
  opLogoPh: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: adminTheme.colors.border, borderStyle: 'dashed' },
  opLogoPhT: { color: adminTheme.colors.textMuted, fontSize: 20 },
  btnLine: { paddingVertical: 8, marginBottom: 4 },
  btnLineT: { color: adminTheme.colors.primary, fontWeight: '700' },
  btnLineDanger: { paddingVertical: 4 },
  btnLineDangerT: { color: adminTheme.colors.error, fontWeight: '600', fontSize: 13 },
  mapPickBtn: {
    backgroundColor: adminTheme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  mapPickBtnT: { color: '#fff', fontWeight: '800' },
  mapAddr: { fontSize: 12, color: adminTheme.colors.textSecondary, marginBottom: 6 },
  mapCoordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  mapCoordL: { fontSize: 11, color: adminTheme.colors.textMuted, width: 28 },
  inFlex: { flex: 1, borderWidth: 1, borderColor: adminTheme.colors.border, borderRadius: 10, padding: 10, backgroundColor: adminTheme.colors.surface },
  in: { borderWidth: 1, borderColor: adminTheme.colors.border, borderRadius: 10, padding: 10, marginBottom: 6, backgroundColor: adminTheme.colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addIm: { marginTop: 12, padding: 12, alignItems: 'center' },
  muted: { fontSize: 12, color: adminTheme.colors.textMuted, marginBottom: 8 },
  mutedSmall: { fontSize: 12, color: adminTheme.colors.textSecondary, flex: 1 },
  thumbRow: { gap: 8, paddingVertical: 8, alignItems: 'center' },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbWrapOn: { borderColor: adminTheme.colors.primary },
  thumb: { width: '100%', height: '100%' },
  save: { backgroundColor: adminTheme.colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  saveT: { color: '#fff', fontWeight: '800' },
  danger: { marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: adminTheme.colors.error, alignItems: 'center' },
  dangerT: { color: adminTheme.colors.error, fontWeight: '800' },
});
