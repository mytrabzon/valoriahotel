/**
 * Yol tarifi - Uygulama içi rota ve adım adım talimatlar (Google Maps'e yönlendirme yok).
 */

import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ValoriaMapView from '@/components/ValoriaMapView';
import { getRoute, formatDuration, formatDistance, estimateWalkingDuration } from '@/lib/map/osrm';
import { theme } from '@/constants/theme';

export default function DirectionsScreen() {
  const params = useLocalSearchParams<{
    fromLat: string;
    fromLng: string;
    toLat: string;
    toLng: string;
    toName?: string;
    toId?: string;
  }>();
  const router = useRouter();
  const fromLat = parseFloat(params.fromLat ?? '0');
  const fromLng = parseFloat(params.fromLng ?? '0');
  const toLat = parseFloat(params.toLat ?? '0');
  const toLng = parseFloat(params.toLng ?? '0');
  const toName = params.toName ?? 'Hedef';

  const [route, setRoute] = useState<Awaited<ReturnType<typeof getRoute>>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fromLat || !fromLng || !toLat || !toLng) {
      setLoading(false);
      return;
    }
    getRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }).then((r) => {
      setRoute(r);
      setLoading(false);
    });
  }, [fromLat, fromLng, toLat, toLng]);

  const routeCoordinates =
    route?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) ?? [];
  const centerLat = routeCoordinates.length ? (fromLat + toLat) / 2 : fromLat;
  const centerLng = routeCoordinates.length ? (fromLng + toLng) / 2 : fromLng;

  const walkDuration = route ? estimateWalkingDuration(route.distance) : 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Rota hesaplanıyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <ValoriaMapView
          latitude={centerLat}
          longitude={centerLng}
          zoom={14}
          routeCoordinates={routeCoordinates}
          hotelMarker={{ lat: fromLat, lng: fromLng, title: 'Valoria Hotel (Siz)' }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>{toName} → Yol tarifi</Text>
        {route ? (
          <>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>⏱️ Araç: {formatDuration(route.duration)}</Text>
              <Text style={styles.meta}>🚶 Yürüme: ~{formatDuration(walkDuration)}</Text>
            </View>
            <Text style={styles.meta}>📏 {formatDistance(route.distance)}</Text>

            <Text style={styles.stepsTitle}>📍 Adım adım</Text>
            <ScrollView style={styles.stepsScroll} showsVerticalScrollIndicator={false}>
              {route.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={styles.stepNum}>{i + 1}.</Text>
                  <Text style={styles.stepText}>
                    {step.maneuver?.instruction ?? step.name ?? 'Devam et'} — {formatDistance(step.distance)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        ) : (
          <Text style={styles.noRoute}>Rota bulunamadı. Lütfen konumları kontrol edin.</Text>
        )}

        {params.toId && (
          <TouchableOpacity
            style={styles.poiLink}
            onPress={() => router.push({ pathname: '/customer/map/poi/[id]', params: { id: params.toId } })}
          >
            <Text style={styles.poiLinkText}>📍 Bu işletmenin detayı</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: theme.colors.textMuted },
  mapWrap: { flex: 1 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '50%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  title: { ...theme.typography.titleSmall, color: theme.colors.text, marginBottom: theme.spacing.sm },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  meta: { fontSize: 14, color: theme.colors.textSecondary },
  stepsTitle: { ...theme.typography.titleSmall, color: theme.colors.text, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  stepsScroll: { maxHeight: 220 },
  stepRow: { flexDirection: 'row', marginBottom: 8 },
  stepNum: { fontWeight: '700', width: 24, color: theme.colors.primary },
  stepText: { flex: 1, fontSize: 14, color: theme.colors.text },
  noRoute: { fontSize: 14, color: theme.colors.textMuted },
  poiLink: { marginTop: theme.spacing.lg },
  poiLinkText: { fontSize: 14, color: theme.colors.primary, fontWeight: '600' },
});
