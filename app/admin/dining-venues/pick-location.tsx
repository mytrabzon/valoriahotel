import { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import CustomerMapPicker from '@/components/CustomerMapPicker';
import { setPendingDiningMapPick } from '@/lib/pendingDiningMapPick';
import { HOTEL_LAT, HOTEL_LON } from '@/lib/diningVenueMapHelpers';
import { adminTheme } from '@/constants/adminTheme';

function formatAddressFromGeocode(
  a: Location.LocationGeocodedAddress | undefined,
  t: (k: string) => string
) {
  if (!a) return '';
  const parts = [
    [a.streetNumber, a.street].filter(Boolean).join(' ').trim(),
    a.district,
    a.subregion,
    a.city,
    a.region,
    a.country,
  ]
    .map((s) => (s ? String(s).trim() : ''))
    .filter(Boolean);
  if (parts.length) return parts.join(', ');
  return t('diningVenuesMapUnknownAddress');
}

export default function DiningVenuesPickLocation() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const initialCenter = useMemo(() => {
    const la = params.lat ? parseFloat(String(params.lat).replace(',', '.')) : NaN;
    const ln = params.lng ? parseFloat(String(params.lng).replace(',', '.')) : NaN;
    if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      return { lat: la, lng: ln };
    }
    return { lat: HOTEL_LAT, lng: HOTEL_LON };
  }, [params.lat, params.lng]);

  const [center, setCenter] = useState(initialCenter);
  const [saving, setSaving] = useState(false);
  const lastRef = useRef(initialCenter);

  const onRegion = useCallback((c: { lat: number; lng: number }) => {
    lastRef.current = c;
    setCenter(c);
  }, []);

  const mapKey = useMemo(() => `pick-${initialCenter.lat}-${initialCenter.lng}`, [initialCenter.lat, initialCenter.lng]);

  const confirm = useCallback(async () => {
    const c = lastRef.current;
    setSaving(true);
    try {
      const list = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
      const a = list[0];
      const address = formatAddressFromGeocode(a, t);
      setPendingDiningMapPick({
        lat: c.lat,
        lng: c.lng,
        address: address || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
      });
      router.back();
    } catch {
      setPendingDiningMapPick({ lat: c.lat, lng: c.lng, address: `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` });
      router.back();
    } finally {
      setSaving(false);
    }
  }, [router, t]);

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>{t('diningVenuesPickMapHint')}</Text>
      <View style={styles.mapWrap}>
        <CustomerMapPicker
          key={mapKey}
          initialLat={initialCenter.lat}
          initialLng={initialCenter.lng}
          initialZoom={15}
          latitude={center.lat}
          longitude={center.lng}
          zoom={15}
          onRegionChange={onRegion}
          onRegionChangeComplete={onRegion}
          style={Platform.OS === 'ios' ? { flex: 1 } : { width: '100%' as const, height: 400 }}
        />
        <View style={styles.crosshair} pointerEvents="none">
          <View style={styles.crossV} />
          <View style={styles.crossH} />
        </View>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.coords}>
          {center.lat.toFixed(5)} · {center.lng.toFixed(5)}
        </Text>
        <TouchableOpacity style={[styles.btn, saving && { opacity: 0.7 }]} onPress={confirm} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnT}>{t('diningVenuesConfirmLocation')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  hint: { paddingHorizontal: 16, paddingVertical: 10, color: adminTheme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  mapWrap: { flex: 1, position: 'relative' },
  crosshair: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  crossV: { position: 'absolute', width: 2, height: 28, backgroundColor: 'rgba(184,134,11,0.95)', borderRadius: 1 },
  crossH: { position: 'absolute', width: 28, height: 2, backgroundColor: 'rgba(184,134,11,0.95)', borderRadius: 1 },
  bottom: { padding: 16, gap: 10, backgroundColor: adminTheme.colors.surface },
  coords: { fontSize: 12, color: adminTheme.colors.textMuted, textAlign: 'center' },
  btn: { backgroundColor: adminTheme.colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnT: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
