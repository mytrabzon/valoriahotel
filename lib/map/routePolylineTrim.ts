import { haversineKm } from '@/lib/diningVenues';

export type LatLng = { lat: number; lng: number };

function haversineMeters(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * 1000;
}

/**
 * p → [a,b] parçasına dik izdüşüm; t ∈ [0,1].
 * Kısa mesafelerde lat/lng doğrusu yeterli.
 */
function projectPointToSegment(
  p: LatLng,
  a: LatLng,
  b: LatLng
): { point: LatLng; t: number; distM: number } {
  const dlat = b.lat - a.lat;
  const dlng = b.lng - a.lng;
  const l2 = dlat * dlat + dlng * dlng;
  if (l2 < 1e-18) {
    const distM = haversineMeters(p, a);
    return { point: { ...a }, t: 0, distM };
  }
  const t = ((p.lat - a.lat) * dlat + (p.lng - a.lng) * dlng) / l2;
  const t0 = Math.max(0, Math.min(1, t));
  const point = { lat: a.lat + t0 * dlat, lng: a.lng + t0 * dlng };
  return { point, t: t0, distM: haversineMeters(p, point) };
}

/**
 * Kullanıcı rota üzerine yaklaştıkça, geçilen kısım "yenilir"; geriye kalan çizgi kısalır.
 * Rota dışındayken (eşik aşılır) tüm rota gösterilir (yeniden hizalama).
 */
export function trimRoutePolyline(
  route: LatLng[],
  user: LatLng,
  options?: { maxOffRouteMeters?: number }
): LatLng[] {
  const maxOff = options?.maxOffRouteMeters ?? 90;
  if (route.length < 2) return route;

  let best: { distM: number; point: LatLng; segIndex: number } | null = null;
  for (let i = 0; i < route.length - 1; i++) {
    const { point, distM } = projectPointToSegment(user, route[i], route[i + 1]);
    if (!best || distM < best.distM) {
      best = { distM, point, segIndex: i };
    }
  }
  if (!best) return route;

  if (best.distM > maxOff) {
    return route;
  }

  const { point, segIndex } = best;
  const tail = route.slice(segIndex + 1);
  if (tail.length === 0) {
    return [point, route[route.length - 1]];
  }
  if (haversineMeters(point, tail[0]) < 2) {
    return [point, ...tail];
  }
  return [point, ...tail];
}

/** Ardışık noktalar boyunca toplam mesafe (m). */
export function pathLengthMeters(points: LatLng[]): number {
  if (points.length < 2) return 0;
  let s = 0;
  for (let i = 0; i < points.length - 1; i++) {
    s += haversineMeters(points[i], points[i + 1]);
  }
  return s;
}
