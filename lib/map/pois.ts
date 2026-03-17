/**
 * Karma POI sistemi: Önce Supabase (kendi DB), yoksa Overpass'tan çek, isteğe bağlı DB'ye yaz.
 */

import { supabase } from '@/lib/supabase';
import { fetchPoisFromOverpass, type OverpassPoi } from './overpass';

export type PoiType = 'restaurant' | 'cafe' | 'hotel' | 'pharmacy' | 'hospital' | 'police' | 'other';

export type Poi = {
  id: string;
  external_id: string | null;
  name: string;
  type: PoiType;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  rating: number | null;
  reviews_count: number | null;
  image_url: string | null;
  source: string;
  created_at?: string;
  updated_at?: string;
};

export type PoiFilters = {
  types?: PoiType[];
  radiusMeters?: number;
};

const POI_TYPE_ORDER: PoiType[] = ['restaurant', 'cafe', 'hotel', 'pharmacy', 'hospital', 'police', 'other'];

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Supabase'den görünüm alanındaki POI'leri getir (bounding box) */
export async function fetchPoisFromDb(
  lat: number,
  lng: number,
  radiusMeters: number = 2000,
  types?: PoiType[]
): Promise<Poi[]> {
  const deltaLat = radiusMeters / 111320;
  const deltaLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const latMin = lat - deltaLat;
  const latMax = lat + deltaLat;
  const lngMin = lng - deltaLng;
  const lngMax = lng + deltaLng;

  let q = supabase
    .from('pois')
    .select('id, external_id, name, type, lat, lng, address, phone, website, hours, rating, reviews_count, image_url, source, created_at, updated_at')
    .gte('lat', latMin)
    .lte('lat', latMax)
    .gte('lng', lngMin)
    .lte('lng', lngMax);

  if (types?.length) {
    q = q.in('type', types);
  }

  const { data, error } = await q;
  if (error) return [];
  const list = (data ?? []) as Poi[];
  list.sort((a, b) => haversineDistance(lat, lng, a.lat, a.lng) - haversineDistance(lat, lng, b.lat, b.lng));
  return list;
}

/** Overpass sonuçlarını Supabase'e yaz (authenticated kullanıcı ile çağrılmalı) */
export async function upsertPoisFromOverpass(pois: OverpassPoi[]): Promise<void> {
  if (pois.length === 0) return;
  const rows = pois.map((p) => ({
    external_id: p.id,
    name: p.name,
    type: p.type,
    lat: p.lat,
    lng: p.lng,
    address: p.address ?? null,
    phone: p.phone ?? null,
    website: p.website ?? null,
    hours: p.hours ?? null,
    raw_tags: p.rawTags ?? null,
    source: 'overpass',
  }));

  for (const row of rows) {
    await supabase.from('pois').upsert(row, {
      onConflict: 'external_id',
      ignoreDuplicates: false,
    });
  }
}

/**
 * Karma: Önce DB'den al, yeterli yoksa Overpass'tan çek ve (authenticated ise) DB'ye yaz, sonuçları birleştir.
 */
export async function fetchPoisHybrid(
  lat: number,
  lng: number,
  radiusMeters: number = 1500,
  filters?: PoiFilters,
  options?: { skipOverpass?: boolean; writeOverpassToDb?: boolean }
): Promise<Poi[]> {
  const types = filters?.types;
  const radius = filters?.radiusMeters ?? radiusMeters;

  const fromDb = await fetchPoisFromDb(lat, lng, radius, types);
  if (options?.skipOverpass) return fromDb;

  const fromOverpass = await fetchPoisFromOverpass(lat, lng, radius).catch(() => [] as OverpassPoi[]);
  if (options?.writeOverpassToDb && fromOverpass.length > 0) {
    upsertPoisFromOverpass(fromOverpass).catch(() => {});
  }

  const byExternalId = new Map<string, Poi>();
  for (const p of fromDb) {
    if (p.external_id) byExternalId.set(p.external_id, p);
    else byExternalId.set(`${p.lat},${p.lng},${p.name}`, p);
  }
  for (const p of fromOverpass) {
    const key = p.id;
    if (!byExternalId.has(key)) {
      byExternalId.set(key, {
        id: p.id,
        external_id: p.id,
        name: p.name,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
        address: p.address ?? null,
        phone: p.phone ?? null,
        website: p.website ?? null,
        hours: p.hours ?? null,
        rating: null,
        reviews_count: null,
        image_url: null,
        source: 'overpass',
      });
    }
  }

  let result = Array.from(byExternalId.values());
  if (types?.length) {
    result = result.filter((r) => types.includes(r.type));
  }
  result.sort((a, b) => {
    const distA = haversineDistance(lat, lng, a.lat, a.lng);
    const distB = haversineDistance(lat, lng, b.lat, b.lng);
    return distA - distB;
  });
  return result;
}

export function getPoiIcon(type: PoiType): string {
  const icons: Record<PoiType, string> = {
    restaurant: '🍔',
    cafe: '☕',
    hotel: '🏨',
    pharmacy: '🛒',
    hospital: '🏥',
    police: '👮',
    other: '📍',
  };
  return icons[type] ?? '📍';
}

export function getPoiTypeLabel(type: PoiType): string {
  const labels: Record<PoiType, string> = {
    restaurant: 'Restoran',
    cafe: 'Kafe',
    hotel: 'Otel',
    pharmacy: 'Eczane',
    hospital: 'Hastane',
    police: 'Jandarma / Karakol',
    other: 'Diğer',
  };
  return labels[type] ?? type;
}

/** Oturum içi POI önbelleği (Overpass'tan gelip henüz DB'de olmayanlar için detay sayfasında kullanılır) */
const poiCache = new Map<string, Poi>();

export function setPoiCache(poi: Poi): void {
  poiCache.set(poi.id, poi);
  if (poi.external_id) poiCache.set(poi.external_id, poi);
}

export function setPoisCache(pois: Poi[]): void {
  pois.forEach(setPoiCache);
}

export function getPoiCache(id: string): Poi | undefined {
  return poiCache.get(id);
}
