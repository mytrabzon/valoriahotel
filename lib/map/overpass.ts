/**
 * Overpass API - OpenStreetMap'ten POI çekme (restoran, eczane, hastane, jandarma vb.)
 * Rate limit: https://overpass-api.de/ kullan; aşırı istek atmaktan kaçın.
 */

export type PoiType = 'restaurant' | 'cafe' | 'hotel' | 'pharmacy' | 'hospital' | 'police' | 'other';

const AMENITY_TO_TYPE: Record<string, PoiType> = {
  restaurant: 'restaurant',
  cafe: 'cafe',
  fast_food: 'restaurant',
  bar: 'cafe',
  hotel: 'hotel',
  hostel: 'hotel',
  pharmacy: 'pharmacy',
  hospital: 'hospital',
  clinic: 'hospital',
  doctors: 'hospital',
  police: 'police',
};

export type OverpassElement = {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

export type OverpassPoi = {
  id: string;
  name: string;
  type: PoiType;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  website?: string;
  hours?: string;
  rawTags?: Record<string, string>;
};

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

function buildQuery(lat: number, lon: number, radiusMeters: number): string {
  return `
[out:json][timeout:25];
(
  node["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});
  node["amenity"="cafe"](around:${radiusMeters},${lat},${lon});
  node["amenity"="fast_food"](around:${radiusMeters},${lat},${lon});
  node["amenity"="hotel"](around:${radiusMeters},${lat},${lon});
  node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
  node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
  node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
  node["amenity"="police"](around:${radiusMeters},${lat},${lon});
);
out body;
`;
}

function elementToPoi(el: OverpassElement): OverpassPoi | null {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags['name:tr'] ?? tags['name:en'] ?? 'İsimsiz';
  const amenity = tags.amenity ?? '';
  const type: PoiType = AMENITY_TO_TYPE[amenity] ?? 'other';

  const address =
    tags['addr:street'] ||
    tags.address ||
    [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(', ') ||
    undefined;

  return {
    id: `node/${el.id}`,
    name,
    type,
    lat: el.lat,
    lng: el.lon,
    address: address || undefined,
    phone: tags.phone ?? tags['contact:phone'] ?? undefined,
    website: tags.website ?? tags['contact:website'] ?? undefined,
    hours: tags.opening_hours ?? undefined,
    rawTags: Object.keys(tags).length ? tags : undefined,
  };
}

export async function fetchPoisFromOverpass(
  lat: number,
  lon: number,
  radiusMeters: number = 1500
): Promise<OverpassPoi[]> {
  const query = buildQuery(lat, lon, radiusMeters);
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' },
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const json = (await res.json()) as { elements?: OverpassElement[] };
  const elements = json.elements ?? [];
  const pois: OverpassPoi[] = [];
  for (const el of elements) {
    if (el.type !== 'node' || el.lat == null || el.lon == null) continue;
    const poi = elementToPoi(el);
    if (poi) pois.push(poi);
  }
  return pois;
}
