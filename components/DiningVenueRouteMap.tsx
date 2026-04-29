import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import CustomerMapPicker from '@/components/CustomerMapPicker';
import { getRoute, type OSRMRoute } from '@/lib/map/osrm';
import { formatRouteDurationI18n, formatRouteDistanceI18n } from '@/lib/map/routeFormatI18n';
import {
  mapCenterForVenueRoute,
  buildVenueMapMarkers,
  HOTEL_LAT,
  HOTEL_LON,
} from '@/lib/diningVenueMapHelpers';
import { theme } from '@/constants/theme';

type Props = {
  venueId: string;
  name: string;
  lat: number;
  lng: number;
  avatarUrl: string | null;
  style?: object;
  minHeight?: number;
};

function routeToCoords(r: OSRMRoute | null): { lat: number; lng: number }[] {
  if (!r?.geometry?.coordinates?.length) return [];
  return r.geometry.coordinates.map(([ln, la]) => ({ lat: la, lng: ln }));
}

export function DiningVenueRouteMap({ venueId, name, lat, lng, avatarUrl, style, minHeight = 280 }: Props) {
  const { t } = useTranslation();
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [route, setRoute] = useState<OSRMRoute | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setRoute(null);
    setUserPos(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let from: { lat: number; lng: number };
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(from);
      } else {
        from = { lat: HOTEL_LAT, lng: HOTEL_LON };
      }
      const r = await getRoute(from, { lat, lng });
      setRoute(r);
    } catch {
      const r = await getRoute({ lat: HOTEL_LAT, lng: HOTEL_LON }, { lat, lng });
      setRoute(r);
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    void load();
  }, [load]);

  const routeCoords = useMemo(() => routeToCoords(route), [route]);
  const { postMarkers } = useMemo(
    () => buildVenueMapMarkers({ id: venueId, name, lat, lng, avatarUrl }),
    [venueId, name, lat, lng, avatarUrl]
  );

  const userMarkers = useMemo(() => {
    if (!userPos) return [];
    return [
      {
        id: 'me',
        lat: userPos.lat,
        lng: userPos.lng,
        displayName: null,
        avatarUrl: null,
        isMe: true,
      },
    ];
  }, [userPos]);

  const { lat: cLat, lng: cLng, zoom } = useMemo(
    () =>
      mapCenterForVenueRoute({
        venueLat: lat,
        venueLng: lng,
        userLat: userPos?.lat ?? null,
        userLng: userPos?.lng ?? null,
        routePoints: routeCoords,
      }),
    [lat, lng, userPos, routeCoords]
  );

  const mapKey = useMemo(
    () => `dv-${venueId}-${routeCoords.length}-${userPos?.lat ?? 'n'}`,
    [venueId, routeCoords.length, userPos]
  );

  if (loading) {
    return (
      <View style={[styles.fallback, { minHeight }, style]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.muted}>{t('diningVenuesMapLoadingRoute')}</Text>
      </View>
    );
  }

  return (
    <View style={[{ minHeight, overflow: 'hidden', borderRadius: 12 }, style]}>
      <CustomerMapPicker
        key={mapKey}
        initialLat={cLat}
        initialLng={cLng}
        initialZoom={zoom}
        latitude={cLat}
        longitude={cLng}
        zoom={zoom}
        routeCoordinates={routeCoords.length >= 2 ? routeCoords : []}
        postMarkers={postMarkers}
        userMarkers={userMarkers}
        style={Platform.OS === 'ios' ? { flex: 1, minHeight } : { width: '100%' as const, height: minHeight }}
      />
      {route ? (
        <View style={styles.eta} pointerEvents="none">
          <Text style={styles.etaT}>
            {formatRouteDistanceI18n(t, route.distance)} · {formatRouteDurationI18n(t, route.duration)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.backgroundSecondary },
  muted: { marginTop: 8, color: theme.colors.textMuted, fontSize: 13 },
  eta: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  etaT: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
