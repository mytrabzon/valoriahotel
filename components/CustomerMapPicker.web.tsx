/**
 * Web: Sadece ValoriaMapView. react-native-maps hiç import edilmez.
 */

import ValoriaMapView from '@/components/ValoriaMapView';
import type { Poi } from '@/lib/map/pois';

export type CustomerMapPickerProps = {
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  pois?: Poi[];
  routeCoordinates?: { lat: number; lng: number }[];
  hotelMarker?: { lat: number; lng: number; title: string };
  onPoiPress?: (poi: Poi) => void;
  onRegionChangeComplete?: (center: { lat: number; lng: number }) => void;
  onRegionChange?: (center: { lat: number; lng: number }) => void;
  style?: object;
};

export default function CustomerMapPicker(props: CustomerMapPickerProps) {
  return (
    <ValoriaMapView
      latitude={props.latitude ?? props.initialLat}
      longitude={props.longitude ?? props.initialLng}
      zoom={props.zoom ?? props.initialZoom ?? 15}
      pois={props.pois}
      routeCoordinates={props.routeCoordinates}
      hotelMarker={props.hotelMarker}
      onPoiPress={props.onPoiPress}
      onRegionChange={props.onRegionChange ?? props.onRegionChangeComplete}
      style={props.style}
    />
  );
}
