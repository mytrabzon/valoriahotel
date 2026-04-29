export type VenueType = 'restaurant' | 'cafe' | 'buffet';
export type LocationScope = 'on_premises' | 'off_premises';

export type DiningMenuItem = {
  name: string;
  description?: string | null;
  price?: number | null;
  image_url?: string | null;
};

export type DiningVenueRow = {
  id: string;
  organization_id: string;
  name: string;
  venue_type: VenueType;
  description: string | null;
  cuisine_tags: string[];
  price_level: number;
  images: string[];
  cover_image: string | null;
  logo_url: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  opening_hours: string | null;
  location_scope: LocationScope;
  is_open_now: boolean;
  directions_text: string | null;
  reservation_info: string | null;
  menu_items: DiningMenuItem[];
  is_active: boolean;
  sort_order: number;
  created_by_staff_id: string | null;
  created_at: string;
  updated_at: string;
};

export function parseMenuItems(raw: unknown): DiningMenuItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DiningMenuItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) continue;
    const price =
      typeof o.price === 'number' && Number.isFinite(o.price)
        ? o.price
        : typeof o.price === 'string' && o.price.trim()
          ? parseFloat(o.price.replace(',', '.'))
          : null;
    out.push({
      name,
      description: typeof o.description === 'string' ? o.description : null,
      price: price != null && Number.isFinite(price) ? price : null,
      image_url: typeof o.image_url === 'string' ? o.image_url : null,
    });
  }
  return out;
}

export function venueRowFromDb(row: Record<string, unknown>): DiningVenueRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name ?? ''),
    venue_type: (row.venue_type as VenueType) ?? 'restaurant',
    description: (row.description as string | null) ?? null,
    cuisine_tags: Array.isArray(row.cuisine_tags) ? (row.cuisine_tags as string[]).map((s) => String(s)) : [],
    price_level: Math.min(3, Math.max(1, Number(row.price_level) || 2)),
    images: Array.isArray(row.images) ? (row.images as string[]).filter(Boolean) : [],
    cover_image: (row.cover_image as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    phone: (row.phone as string | null) ?? null,
    opening_hours: (row.opening_hours as string | null) ?? null,
    location_scope: (row.location_scope as LocationScope) ?? 'off_premises',
    is_open_now: Boolean(row.is_open_now),
    directions_text: (row.directions_text as string | null) ?? null,
    reservation_info: (row.reservation_info as string | null) ?? null,
    menu_items: parseMenuItems(row.menu_items),
    is_active: row.is_active !== false,
    sort_order: Number(row.sort_order) || 0,
    created_by_staff_id: (row.created_by_staff_id as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export function priceLevelLabel(level: number): string {
  const n = Math.min(3, Math.max(1, level));
  return '●'.repeat(n);
}

const LOCALE_BY_LANG: Record<string, string> = {
  tr: 'tr-TR',
  en: 'en-GB',
  ar: 'ar-EG',
  de: 'de-DE',
  fr: 'fr-FR',
  ru: 'ru-RU',
  es: 'es-ES',
};

/** Menü fiyatı (TRY) — uygulama diliyle sayı/para biçimini hizalar. */
export function formatDiningMenuPriceTry(i18nLanguage: string, amount: number): string {
  const base = (i18nLanguage || 'en').split('-')[0] ?? 'en';
  const locale = LOCALE_BY_LANG[base] ?? 'en-GB';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function venueAvatarUrl(
  v: Pick<DiningVenueRow, 'logo_url' | 'cover_image' | 'images'>
): string | null {
  const logo = v.logo_url?.trim();
  if (logo) return logo;
  const cov = v.cover_image?.trim();
  if (cov) return cov;
  const im = (v.images ?? []).filter(Boolean);
  return im[0] ?? null;
}

export function galleryUrls(v: DiningVenueRow): string[] {
  const im = (v.images ?? []).filter(Boolean);
  if (v.cover_image && im.includes(v.cover_image)) return [v.cover_image, ...im.filter((u) => u !== v.cover_image)].slice(0, 10);
  if (v.cover_image) return [v.cover_image, ...im].slice(0, 10);
  return im.slice(0, 10);
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
