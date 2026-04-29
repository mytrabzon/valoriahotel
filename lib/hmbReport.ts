/**
 * HMB (Hazine ve Maliye Bakanlığı) Günlük Müşteri Listesi raporu – veri ve PDF HTML.
 * VUK Md. 240 gereğince.
 */
import { supabase } from '@/lib/supabase';
import { HMB_HOTEL_INFO, VAT_RATE, ACCOMMODATION_TAX_RATE } from '@/constants/hmbHotel';
import type { HmbFormBranding, HmbFormMeta } from '@/lib/hmbFormBranding';
import { buildHmbOfficialDailyListHtml } from '@/lib/hmbOfficialDailyListHtml';
import { format, parseISO, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

function shortDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = parseISO(s);
  return isValid(d) ? format(d, 'dd.MM.yyyy', { locale: tr }) : '—';
}

export type GuestFilterType = 'all' | 'checked_in' | 'checked_out' | 'active';

export type HmbReportFilters = {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  roomIds: string[] | null; // null = tüm odalar
  guestType: GuestFilterType;
};

export type GuestRow = {
  id: string;
  full_name: string;
  id_number: string | null;
  id_type: string | null;
  nationality: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  room_id: string | null;
  total_amount_net: number | null;
  vat_amount: number | null;
  accommodation_tax_amount: number | null;
  rooms: { room_number: string; price_per_night: number | null } | null;
};

/** Tek bir "konaklama" (oda + giriş/çıkış grubu) */
export type StayRow = {
  room_number: string;
  room_id: string;
  check_in_at: string;
  check_out_at: string | null;
  nights: number;
  guests: {
    full_name: string;
    id_number: string | null;
    id_type: string | null;
    nationality: string | null;
  }[];
  total_net: number;
  vat: number;
  accommodation_tax: number;
};

export type HmbReportData = {
  stays: StayRow[];
  totalStays: number;
  totalGuests: number;
  totalNights: number;
  totalRevenueNet: number;
  totalVat: number;
  totalAccommodationTax: number;
  generatedAt: string;
  reportNumber: string;
};

function parseDateSafe(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

function nightsBetween(checkIn: string, checkOut: string | null): number {
  const start = parseDateSafe(checkIn);
  const end = checkOut ? parseDateSafe(checkOut) : new Date();
  if (!start) return 0;
  const endD = end ?? new Date();
  const diff = Math.max(0, Math.ceil((endD.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  return diff || 1;
}

/** Filtrelere göre konaklama listesini çek ve grupla */
export async function fetchHmbReportData(filters: HmbReportFilters): Promise<HmbReportData> {
  const start = `${filters.startDate}T00:00:00.000Z`;
  const end = `${filters.endDate}T23:59:59.999Z`;

  let query = supabase
    .from('guests')
    .select(
      'id, full_name, id_number, id_type, nationality, check_in_at, check_out_at, status, room_id, total_amount_net, vat_amount, accommodation_tax_amount, rooms(room_number, price_per_night)'
    )
    .not('room_id', 'is', null)
    .not('check_in_at', 'is', null);

  switch (filters.guestType) {
    case 'checked_in':
      query = query.gte('check_in_at', start).lte('check_in_at', end);
      break;
    case 'checked_out':
      query = query
        .not('check_out_at', 'is', null)
        .gte('check_out_at', start)
        .lte('check_out_at', end);
      break;
    case 'active':
      query = query.eq('status', 'checked_in').lte('check_in_at', end).or(`check_out_at.is.null,check_out_at.gte.${start}`);
      break;
    default:
      query = query.lte('check_in_at', end).or(`check_out_at.is.null,check_out_at.gte.${start}`);
      break;
  }

  if (filters.roomIds?.length) {
    query = query.in('room_id', filters.roomIds);
  }

  const { data: rows, error } = await query.order('check_in_at', { ascending: true });

  if (error) throw new Error(error.message);

  const list = (rows ?? []) as GuestRow[];

  // Grupla: (room_id, check_in_at, check_out_at) -> StayRow
  const groupKey = (g: GuestRow) =>
    `${g.room_id ?? ''}|${g.check_in_at ?? ''}|${g.check_out_at ?? ''}`;
  const groups = new Map<string, GuestRow[]>();
  for (const g of list) {
    const key = groupKey(g);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }

  const stays: StayRow[] = [];
  let totalNights = 0;
  let totalRevenueNet = 0;
  let totalVat = 0;
  let totalAccommodationTax = 0;

  for (const [, guests] of groups) {
    const first = guests[0];
    const roomNumber = first.rooms?.room_number ?? '—';
    const roomId = first.room_id ?? '';
    const checkIn = first.check_in_at ?? '';
    const checkOut = first.check_out_at ?? null;
    const nights = nightsBetween(checkIn, checkOut);
    const pricePerNight = first.rooms?.price_per_night ?? 0;

    let total_net = 0;
    let vat = 0;
    let accTax = 0;
    const hasStoredAmounts = guests.some(
      (x) => x.total_amount_net != null && Number(x.total_amount_net) > 0
    );
    if (hasStoredAmounts) {
      total_net = guests.reduce((s, x) => s + (Number(x.total_amount_net) ?? 0), 0);
      vat = guests.reduce((s, x) => s + (Number(x.vat_amount) ?? 0), 0);
      accTax = guests.reduce((s, x) => s + (Number(x.accommodation_tax_amount) ?? 0), 0);
    } else {
      total_net = pricePerNight ? pricePerNight * nights : 0;
      vat = total_net * VAT_RATE;
      accTax = total_net * ACCOMMODATION_TAX_RATE;
    }

    totalNights += nights;
    totalRevenueNet += total_net;
    totalVat += vat;
    totalAccommodationTax += accTax;

    stays.push({
      room_number: roomNumber,
      room_id: roomId,
      check_in_at: checkIn,
      check_out_at: checkOut,
      nights,
      guests: guests.map((x) => ({
        full_name: x.full_name,
        id_number: x.id_number,
        id_type: x.id_type,
        nationality: x.nationality,
      })),
      total_net,
      vat,
      accommodation_tax: accTax,
    });
  }

  const generatedAt = new Date().toISOString();
  const reportNumber = `HMB-${new Date().getFullYear()}-${String(stays.length).padStart(3, '0')}`;

  return {
    stays,
    totalStays: stays.length,
    totalGuests: list.length,
    totalNights,
    totalRevenueNet,
    totalVat,
    totalAccommodationTax,
    generatedAt,
    reportNumber,
  };
}

/** PDF için HTML — matbaa tarzı günlük liste şablonu (işletme bilgisi + form meta ile). */
export function buildHmbReportHtml(
  data: HmbReportData,
  filters: HmbReportFilters,
  authorizedName: string,
  branding: HmbFormBranding,
  formMeta: HmbFormMeta
): string {
  return buildHmbOfficialDailyListHtml(data, filters, authorizedName, branding, formMeta);
}
