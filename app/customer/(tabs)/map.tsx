/**
 * Valoria Harita - Restoran, eczane, hastane, jandarma vb. tek haritada.
 * Yol tarifi ve detay uygulama içi (Google Maps'e yönlendirme yok).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import CustomerMapPicker from '@/components/CustomerMapPicker';
import {
  fetchPoisHybrid,
  getPoiIcon,
  getPoiTypeLabel,
  setPoisCache,
  type Poi,
  type PoiType,
} from '@/lib/map/pois';
import { getRoute, formatDuration, formatDistance, estimateWalkingDuration } from '@/lib/map/osrm';
import type { OSRMRoute } from '@/lib/map/osrm';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HOTEL_LAT = typeof process.env.EXPO_PUBLIC_HOTEL_LAT !== 'undefined' ? Number(process.env.EXPO_PUBLIC_HOTEL_LAT) : 40.6144;
const HOTEL_LON = typeof process.env.EXPO_PUBLIC_HOTEL_LON !== 'undefined' ? Number(process.env.EXPO_PUBLIC_HOTEL_LON) : 40.31188;

const POI_TYPES: PoiType[] = ['restaurant', 'cafe', 'hotel', 'pharmacy', 'hospital', 'police'];

const TAB_BAR_ESTIMATE = 90;

export default function CustomerMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const { user } = useAuthStore();
  const [pois, setPois] = useState<Poi[]>([]);
  const [filterTypes, setFilterTypes] = useState<PoiType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [layoutHeight, setLayoutHeight] = useState(Math.max(300, winHeight - TAB_BAR_ESTIMATE));
  const [poiCenter, setPoiCenter] = useState({ lat: HOTEL_LAT, lng: HOTEL_LON });
  const [routeData, setRouteData] = useState<{ route: OSRMRoute; toName: string } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPois = useCallback(async () => {
    setLoading(true);
    const center = userLocation ?? poiCenter;
    const lat = center.lat;
    const lng = center.lng;
    const list = await fetchPoisHybrid(lat, lng, 3500, { types: filterTypes.length ? filterTypes : undefined }, {
      writeOverpassToDb: !!user,
    });
    setPois(list);
    setLoading(false);
  }, [poiCenter.lat, poiCenter.lng, filterTypes, user, userLocation]);

  const handleRegionChange = useCallback((center: { lat: number; lng: number }) => {
    setPoiCenter(center);
  }, []);

  // Filtre tıklandığında hemen POI yükle; arama yazılırken debounce.
  useEffect(() => {
    const q = searchQuery.trim();
    const hasFilter = filterTypes.length > 0;
    if (!q && !hasFilter) {
      setPois([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (hasFilter && !q) {
      loadPois();
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      loadPois();
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, filterTypes, loadPois]);

  useEffect(() => {
    setPoisCache(pois);
  }, [pois]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({}).catch(() => null);
        if (loc) setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

  const q = searchQuery.trim().toLowerCase();
  const filteredPois = q
    ? pois.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          getPoiTypeLabel(p.type).toLowerCase().includes(q)
      )
    : filterTypes.length > 0
      ? pois.filter((p) => filterTypes.includes(p.type))
      : pois;

  const toggleFilter = (type: PoiType) => {
    setFilterTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const goBack = () => router.replace('/customer');

  const showSuggestions = searchQuery.trim().length > 0 || filterTypes.length > 0;
  const fromForDirections = userLocation ?? { lat: HOTEL_LAT, lng: HOTEL_LON };

  const routeCoordinates =
    routeData?.route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })) ?? [];

  const showRouteToPoi = (poi: Poi) => {
    setRouteLoading(true);
    setRouteData(null);
    getRoute(fromForDirections, { lat: poi.lat, lng: poi.lng }).then((r) => {
      setRouteLoading(false);
      setRouteData(r ? { route: r, toName: poi.name } : null);
    });
  };

  const dismissSearchAndSuggestions = () => {
    Keyboard.dismiss();
    setSearchQuery('');
    setFilterTypes([]);
    setRouteData(null);
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { height } = e.nativeEvent.layout;
        if (height > 100) setLayoutHeight(Math.round(height));
      }}
      pointerEvents="box-none"
    >
      {/* Boşluğa (haritaya) tıklanınca klavye kapansın ve öneriler kaybolsun */}
      <TouchableWithoutFeedback onPress={dismissSearchAndSuggestions} accessible={false}>
        <View style={[styles.mapContainer, { width: winWidth, height: layoutHeight }]} pointerEvents="box-none">
          <CustomerMapPicker
            initialLat={HOTEL_LAT}
            initialLng={HOTEL_LON}
            initialZoom={15}
            pois={filteredPois}
            routeCoordinates={routeCoordinates}
            hotelMarker={{ lat: HOTEL_LAT, lng: HOTEL_LON, title: 'Valoria Hotel' }}
            onPoiPress={showRouteToPoi}
            onRegionChangeComplete={handleRegionChange}
            style={{ width: winWidth, height: Math.max(300, layoutHeight) }}
          />
        </View>
      </TouchableWithoutFeedback>

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {routeLoading && (
        <View style={[styles.loadingOverlay, { bottom: 200 }]} pointerEvents="none">
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.routeLoadingText}>Rota hesaplanıyor...</Text>
        </View>
      )}

      {routeData && (
        <View style={[styles.routeSheet, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.routeSheetTitle}>📍 {routeData.toName}</Text>
          <View style={styles.routeMetaRow}>
            <Text style={styles.routeMeta}>⏱️ {formatDuration(routeData.route.duration)}</Text>
            <Text style={styles.routeMeta}>🚶 ~{formatDuration(estimateWalkingDuration(routeData.route.distance))}</Text>
            <Text style={styles.routeMeta}>📏 {formatDistance(routeData.route.distance)}</Text>
          </View>
          <Text style={styles.routeStepsTitle}>Adım adım</Text>
          <ScrollView style={styles.routeStepsScroll} showsVerticalScrollIndicator={false}>
            {routeData.route.steps.map((step, i) => (
              <View key={i} style={styles.routeStepRow}>
                <Text style={styles.routeStepNum}>{i + 1}.</Text>
                <Text style={styles.routeStepText}>
                  {step.maneuver?.instruction ?? step.name ?? 'Devam et'} — {formatDistance(step.distance)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.routeCloseBtn} onPress={() => setRouteData(null)} activeOpacity={0.8}>
            <Text style={styles.routeCloseBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Üst kontroller: sadece üst şerit, harita dokunmaya açık */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 12 }]}
        onPress={goBack}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </TouchableOpacity>

      <View style={[styles.topBar, { paddingTop: insets.top + 12, paddingBottom: theme.spacing.sm }]} pointerEvents="box-none">
        <View style={styles.topBarContent}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 İşletme veya tür ara..."
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {POI_TYPES.map((type) => {
              const active = filterTypes.includes(type);
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => toggleFilter(type)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {getPoiIcon(type)} {getPoiTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {showSuggestions && (
            <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {loading && filteredPois.length === 0 ? (
                <Text style={styles.suggestionPlaceholder}>Aranıyor...</Text>
              ) : filteredPois.length === 0 ? (
                <View style={styles.emptySuggestions}>
                  <Text style={styles.suggestionPlaceholder}>Bu bölgede mekan bulunamadı.</Text>
                  <Text style={styles.suggestionHint}>Haritayı kaydırıp başka bölgeye tıklayın veya konum iznini açın.</Text>
                </View>
              ) : (
                filteredPois.map((poi) => (
                  <View key={poi.id} style={styles.suggestionRow}>
                    <TouchableOpacity
                      style={styles.suggestionRowMain}
                      onPress={() => showRouteToPoi(poi)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionIcon}>{getPoiIcon(poi.type)}</Text>
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionName} numberOfLines={1}>{poi.name}</Text>
                        <Text style={styles.suggestionMeta}>{getPoiTypeLabel(poi.type)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.directionsBtn}
                      onPress={() => showRouteToPoi(poi)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="navigate" size={18} color={theme.colors.primary} />
                      <Text style={styles.directionsBtnText}>Yol tarifi</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1d21',
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  mapFill: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    left: theme.spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    ...theme.shadows.sm,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingLeft: 56 + theme.spacing.lg,
    paddingRight: theme.spacing.lg,
  },
  searchRow: { marginBottom: theme.spacing.sm },
  searchInput: {
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: theme.spacing.lg,
    fontSize: 15,
    color: theme.colors.text,
  },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  filterChipActive: { backgroundColor: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.6)' },
  filterChipText: { fontSize: 12, color: theme.colors.textSecondary },
  filterChipTextActive: { color: theme.colors.text, fontWeight: '600' },
  topBarContent: { maxHeight: 280 },
  suggestionsList: { maxHeight: 200, marginTop: theme.spacing.sm },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: theme.radius.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  suggestionRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  suggestionIcon: { fontSize: 20, marginRight: 10 },
  suggestionInfo: { flex: 1, minWidth: 0 },
  suggestionName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  suggestionMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginLeft: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  directionsBtnText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
  suggestionPlaceholder: { fontSize: 14, color: theme.colors.textMuted, paddingVertical: 12, paddingHorizontal: 4 },
  emptySuggestions: { paddingVertical: 12, paddingHorizontal: 4 },
  suggestionHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6, paddingHorizontal: 4 },
  loadingOverlay: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 8,
    borderRadius: theme.radius.full,
    zIndex: 0,
  },
  routeLoadingText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  routeSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '48%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    zIndex: 15,
    ...theme.shadows.lg,
  },
  routeSheetTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  routeMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  routeMeta: { fontSize: 13, color: theme.colors.textSecondary },
  routeStepsTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 4, marginBottom: 6 },
  routeStepsScroll: { maxHeight: 160 },
  routeStepRow: { flexDirection: 'row', marginBottom: 6 },
  routeStepNum: { fontWeight: '700', width: 22, color: theme.colors.primary, fontSize: 13 },
  routeStepText: { flex: 1, fontSize: 13, color: theme.colors.text },
  routeCloseBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  routeCloseBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});
