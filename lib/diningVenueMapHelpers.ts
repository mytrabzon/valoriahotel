import type { MapPostMarker, MapUserMarker } from '@/lib/map/types';

const HOTEL_LAT =
  typeof process.env.EXPO_PUBLIC_HOTEL_LAT !== 'undefined' ? Number(process.env.EXPO_PUBLIC_HOTEL_LAT) : 40.6144;
const HOTEL_LON =
  typeof process.env.EXPO_PUBLIC_HOTEL_LON !== 'undefined' ? Number(process.env.EXPO_PUBLIC_HOTEL_LON) : 40.31188;

export { HOTEL_LAT, HOTEL_LON };

/**
 * Rota + kullanıcı + mekan noktalarını içeren kutu; harita initial merkez/zoom.
 */
export function mapCenterForVenueRoute(params: {
  venueLat: number;
  venueLng: number;
  userLat: number | null;
  userLng: number | null;
  routePoints: { lat: number; lng: number }[];
}): { lat: number; lng: number; zoom: number } {
  const pts: { lat: number; lng: number }[] = [
    { lat: params.venueLat, lng: params.venueLng },
    ...(params.userLat != null && params.userLng != null ? [{ lat: params.userLat, lng: params.userLng }] : []),
  ];
  if (params.routePoints.length >= 2) {
    pts.push(...params.routePoints);
  } else if (params.userLat == null) {
    pts.push({ lat: HOTEL_LAT, lng: HOTEL_LON });
  }
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.005);
  const zoom = span > 0.2 ? 11 : span > 0.05 ? 13 : 14;
  return { lat: midLat, lng: midLng, zoom };
}

export function buildVenueMapMarkers(venue: {
  id: string;
  name: string;
  lat: number;
  lng: number;
  avatarUrl: string | null;
}): { postMarkers: MapPostMarker[]; userMarkers: MapUserMarker[] } {
  return {
    postMarkers: [
      {
        id: `dining-venue-${venue.id}`,
        lat: venue.lat,
        lng: venue.lng,
        displayName: venue.name,
        avatarUrl: venue.avatarUrl,
      },
    ],
    userMarkers: [],
  };
}
