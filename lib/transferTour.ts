import type { LangCode } from '@/i18n';
import { LANGUAGES } from '@/i18n';

export const TRANSFER_SERVICE_TYPES = ['transfer', 'tour', 'vip', 'custom_route'] as const;
export type TransferServiceType = (typeof TRANSFER_SERVICE_TYPES)[number];

export const VEHICLE_SIZES = ['small', 'medium', 'large', 'vip'] as const;
export type VehicleSize = (typeof VEHICLE_SIZES)[number];

export const PRICING_TYPES = ['fixed', 'per_person', 'quote'] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

export const AVAILABILITY = ['available', 'limited', 'on_request'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY)[number];

export const REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'price_offer',
  'completed',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const FEATURE_KEYS = [
  'air_conditioning',
  'wifi',
  'child_seat',
  'driver_included',
  'non_smoking',
  'vip',
  'luggage',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type I18nJson = Partial<Record<LangCode, string>> & Record<string, string | undefined>;

export function buildUniversalI18n(text: string): I18nJson {
  const t = (text ?? '').trim();
  const o: Record<string, string> = { default: t };
  for (const { code } of LANGUAGES) {
    o[code] = t;
  }
  return o as I18nJson;
}

/** Yönetim formu: metin yalnızca Türkçe kaydedilir (default + tr). */
export function buildTurkishContentI18n(text: string): I18nJson {
  const s = (text ?? '').trim();
  if (!s) return { default: '', tr: '' };
  return { default: s, tr: s };
}

/** Hizmet rotası: araç otele / kapıya gelir (sabit açıklama, Türkçe). */
export const DEFAULT_TRANSFER_SERVICE_ROUTE_FROM_TR = 'Araç otele veya misafir kapısına gelir';
export const DEFAULT_TRANSFER_SERVICE_ROUTE_TO_TR = 'Bırakış: otel önü (aynı nokta)';

/** Düzenleme formu: herhangi bir dildeki metni tek alana yükler (eski çok dilli kayıtlar uyumu). */
export function firstTextFromI18n(v: I18nJson | null | undefined): string {
  if (!v || typeof v !== 'object') return '';
  const rec = v as Record<string, string | undefined>;
  if (rec.default && String(rec.default).trim()) return String(rec.default).trim();
  for (const { code } of LANGUAGES) {
    const x = rec[code];
    if (x && String(x).trim()) return String(x).trim();
  }
  for (const k of Object.keys(rec)) {
    if (k === 'default') continue;
    const x = rec[k];
    if (x && String(x).trim()) return String(x).trim();
  }
  return '';
}

export function pickLocalizedString(
  v: I18nJson | null | undefined,
  lang: string,
  fallback: string
): string {
  if (!v || typeof v !== 'object') return fallback;
  const rec = v as Record<string, string | undefined>;
  const l = (lang || 'en').split('-')[0] as LangCode;
  if (rec[l] && String(rec[l]).trim()) return String(rec[l]).trim();
  if (rec.default && String(rec.default).trim()) return String(rec.default).trim();
  const en = rec.en;
  if (en && en.trim()) return en.trim();
  const tr = rec.tr;
  if (tr && tr.trim()) return tr.trim();
  for (const { code } of LANGUAGES) {
    const t = rec[code];
    if (t && t.trim()) return t.trim();
  }
  return fallback;
}

export type RouteLeg = {
  from: I18nJson;
  to: I18nJson;
  distance_km: number | null;
  duration_min: number | null;
  price: number | null;
};

export type TransferServiceRow = {
  id: string;
  organization_id: string;
  service_type: TransferServiceType;
  title: I18nJson;
  description: I18nJson;
  brand: string | null;
  model: string | null;
  year: number | null;
  vehicle_size: VehicleSize;
  capacity: number;
  luggage_capacity: number;
  images: string[] | null;
  cover_image: string | null;
  routes: RouteLeg[];
  pricing_type: PricingType;
  price: number | null;
  currency: string;
  features: string[] | null;
  is_active: boolean;
  availability_status: AvailabilityStatus;
  /** Araç / tur hizmetini sunan dış operatör (misafirde görünür) */
  tour_operator_name: string | null;
  /** Operatör logosu (public URL) */
  tour_operator_logo: string | null;
  map_lat: number | null;
  map_lng: number | null;
  map_address: string | null;
  created_by_staff_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TransferRequestRow = {
  id: string;
  organization_id: string;
  service_id: string;
  guest_id: string;
  guest_name: string | null;
  room_number: string | null;
  request_date: string;
  request_time: string;
  passenger_count: number;
  pickup_location: string;
  dropoff_location: string;
  phone: string | null;
  note: string | null;
  child_seat_requested: boolean;
  luggage_count: number;
  status: RequestStatus;
  price_offer: number | null;
  offer_currency: string | null;
  staff_note: string | null;
  handled_by_staff_id: string | null;
  created_at: string;
  updated_at: string;
  transfer_services?: { title: I18nJson; cover_image: string | null; pricing_type: PricingType; price: number | null; currency: string } | null;
};

export function parseRoutes(raw: unknown): RouteLeg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      return {
        from: (o.from as I18nJson) || {},
        to: (o.to as I18nJson) || {},
        distance_km: typeof o.distance_km === 'number' ? o.distance_km : o.distance_km == null ? null : Number(o.distance_km),
        duration_min: typeof o.duration_min === 'number' ? o.duration_min : o.duration_min == null ? null : Number(o.duration_min),
        price: typeof o.price === 'number' ? o.price : o.price == null ? null : Number(o.price),
      } as RouteLeg;
    })
    .filter(Boolean) as RouteLeg[];
}

export function serviceRowFromDb(r: Record<string, unknown>): TransferServiceRow {
  const rawType = (r.service_type as string) || 'transfer';
  const service_type: TransferServiceType =
    rawType === 'vehicle_rental' ? 'transfer' : (rawType as TransferServiceType);

  return {
    id: r.id as string,
    organization_id: r.organization_id as string,
    service_type,
    title: (r.title as I18nJson) || {},
    description: (r.description as I18nJson) || {},
    brand: (r.brand as string) || null,
    model: (r.model as string) || null,
    year: (r.year as number) ?? null,
    vehicle_size: (r.vehicle_size as VehicleSize) || 'medium',
    capacity: Number(r.capacity) || 0,
    luggage_capacity: Number(r.luggage_capacity) || 0,
    images: Array.isArray(r.images) ? (r.images as string[]) : [],
    cover_image: (r.cover_image as string) || null,
    routes: parseRoutes(r.routes),
    pricing_type: (r.pricing_type as PricingType) || 'fixed',
    price: r.price == null ? null : Number(r.price),
    currency: (r.currency as string) || 'TRY',
    features: Array.isArray(r.features) ? (r.features as string[]) : [],
    is_active: !!r.is_active,
    availability_status: (r.availability_status as AvailabilityStatus) || 'available',
    tour_operator_name: (r.tour_operator_name as string) || null,
    tour_operator_logo: (r.tour_operator_logo as string) || null,
    map_lat: (() => {
      if (r.map_lat == null || r.map_lat === '') return null;
      const n = Number(r.map_lat);
      return Number.isFinite(n) ? n : null;
    })(),
    map_lng: (() => {
      if (r.map_lng == null || r.map_lng === '') return null;
      const n = Number(r.map_lng);
      return Number.isFinite(n) ? n : null;
    })(),
    map_address: (r.map_address as string) || null,
    created_by_staff_id: (r.created_by_staff_id as string) || null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}
