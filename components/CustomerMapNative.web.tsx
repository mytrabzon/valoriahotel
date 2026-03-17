/**
 * Web: react-native-maps kullanılmaz; bu sayfa web'de ValoriaMapView ile çizilir.
 * Bu dosya sadece web bundle'da kullanılır, native kod import edilmez.
 */

import { View } from 'react-native';
import type { Poi } from '@/lib/map/pois';

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

export default function CustomerMapNative(_props: CustomerMapNativeProps) {
  return <View style={{ flex: 1 }} />;
}
