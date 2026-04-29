/**
 * OSRM - Açık yol tarifi API (Google Maps'e yönlendirme yok, uygulama içi)
 * Public demo: https://router.project-osrm.org/
 */

export type OSRMRouteStep = {
  distance: number; // metre
  duration: number; // saniye
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
    instruction?: string;
  };
};

export type OSRMRoute = {
  distance: number; // metre
  duration: number; // saniye
  steps: OSRMRouteStep[];
  geometry: { coordinates: [number, number][] }; // [lng, lat][]
};

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

/**
 * İki nokta arası sürüş rotası (geometri + adım adım)
 * Koordinatlar: [lon, lat] (GeoJSON sırası)
 */
export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<OSRMRoute | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&steps=true&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { code?: string; routes?: Array<{
    distance: number;
    duration: number;
    legs?: Array<{
      steps: OSRMRouteStep[];
      distance: number;
      duration: number;
    }>;
    geometry?: { coordinates: [number, number][] };
  }> };
  if (json.code !== 'Ok' || !json.routes?.length) return null;
  const route = json.routes[0];
  const leg = route.legs?.[0];
  const steps = leg?.steps ?? [];
  const geometry = route.geometry?.coordinates ?? [];
  return {
    distance: route.distance ?? leg?.distance ?? 0,
    duration: route.duration ?? leg?.duration ?? 0,
    steps,
    geometry: { coordinates: geometry },
  };
}

/**
 * Yürüme rotası (foot/walk) - OSRM demo sadece driving destekler; alternatif: foot profile farklı sunucu gerekir.
 * Şimdilik driving döndürüyoruz; metin olarak "yürüme süresi tahmini" eklenebilir (distance/80 * 60 sn).
 */
export function estimateWalkingDuration(distanceMeters: number): number {
  const walkingSpeedMps = 1.2; // ~4.3 km/h
  return Math.round(distanceMeters / walkingSpeedMps);
}

/**
 * Eski yardımcı: harita rota arayüzü için `formatRouteDurationI18n` tercih edin.
 * Burada yalnızca nötr/İngilizce kısa biçim (diğer ekranlar hâlâ bu fonksiyonu kullanabilir).
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return '< 1 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}
