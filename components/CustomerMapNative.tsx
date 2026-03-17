/**
 * iOS için native MapKit (react-native-maps).
 * Zoom/pan state'i native tarafta kalır, geri dönmez.
 */

import { useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import type { Poi } from '@/lib/map/pois';

const DEFAULT_LAT = 40.6144;
const DEFAULT_LON = 40.31188;

export type CustomerMapNativeProps = {
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  pois?: Poi[];
  routeCoordinates?: { lat: number; lng: number }[];
  hotelMarker?: { lat: number; lng: number; title: string };
  onPoiPress?: (poi: Poi) => void;
  onRegionChangeComplete?: (center: { lat: number; lng: number }) => void;
  style?: object;
};

const latLngToDelta = (zoom: number) => {
  const d = 360 / Math.pow(2, zoom);
  return { latitudeDelta: d / 2, longitudeDelta: d };
};

export default function CustomerMapNative({
  initialLat = DEFAULT_LAT,
  initialLng = DEFAULT_LON,
  initialZoom = 15,
  pois = [],
  routeCoordinates = [],
  hotelMarker,
  onPoiPress,
  onRegionChangeComplete,
  style,
}: CustomerMapNativeProps) {
  const mapRef = useRef<MapView>(null);
  const { latitudeDelta, longitudeDelta } = latLngToDelta(initialZoom);

  const initialRegion = {
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta,
    longitudeDelta,
  };

  const onRegionChangeCompleteHandler = useCallback(
    (e: { latitude: number; longitude: number }) => {
      onRegionChangeComplete?.({ lat: e.latitude, lng: e.longitude });
    },
    [onRegionChangeComplete]
  );

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        mapType="standard"
        showsUserLocation
        showsCompass
        onRegionChangeComplete={onRegionChangeCompleteHandler}
        provider={PROVIDER_DEFAULT}
      >
        {hotelMarker && (
          <Marker
            coordinate={{ latitude: hotelMarker.lat, longitude: hotelMarker.lng }}
            title={hotelMarker.title}
            identifier="hotel"
          />
        )}
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            title={poi.name}
            identifier={poi.id}
            onPress={() => onPoiPress?.(poi)}
          />
        ))}
        {routeCoordinates.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates.map((c) => ({ latitude: c.lat, longitude: c.lng }))}
            strokeColor="#b8860b"
            strokeWidth={4}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  map: { width: '100%', height: '100%' },
});
