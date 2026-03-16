/**
 * GEOLOCATION (KONUM BAZLI) - Otel yakınına gelince bildirim
 * Mesafe: 5km uyarı, 1km check-in teklifi, 100m sözleşme hazır
 */
import * as Location from 'expo-location';

export type GeofenceRadius = 5000 | 1000 | 500 | 100; // metre

export interface HotelGeofenceConfig {
  latitude: number;
  longitude: number;
  /** Metre cinsinden; varsayılan 500m */
  radius?: number;
}

let watchSubscription: Location.LocationSubscription | null = null;

/**
 * Konum izni iste
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Otel koordinatlarına uzaklık (metre)
 */
export function getDistanceFromHotel(
  lat: number,
  lon: number,
  hotel: HotelGeofenceConfig
): number {
  const R = 6371e3; // Dünya yarıçapı metre
  const φ1 = (hotel.latitude * Math.PI) / 180;
  const φ2 = (lat * Math.PI) / 180;
  const Δφ = ((lat - hotel.latitude) * Math.PI) / 180;
  const Δλ = ((lon - hotel.longitude) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Konum izlenmeye başla; otel yakınına gelince callback çağır
 */
export async function startGeofenceWatch(
  hotel: HotelGeofenceConfig,
  onNearby: (distance: number) => void,
  onError?: (e: Error) => void
): Promise<boolean> {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    onError?.(new Error('Konum izni verilmedi'));
    return false;
  }
  stopGeofenceWatch();
  const radius = hotel.radius ?? 500;
  watchSubscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
    (loc) => {
      const distance = getDistanceFromHotel(
        loc.coords.latitude,
        loc.coords.longitude,
        hotel
      );
      if (distance <= radius) onNearby(distance);
    }
  );
  return true;
}

export function stopGeofenceWatch(): void {
  if (watchSubscription) {
    watchSubscription.remove();
    watchSubscription = null;
  }
}
