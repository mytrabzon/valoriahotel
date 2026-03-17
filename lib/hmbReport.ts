/**
 * HMB (Hazine ve Maliye Bakanlığı) Günlük Müşteri Listesi raporu – veri ve PDF HTML.
 * VUK Md. 240 gereğince.
 */
import { supabase } from '@/lib/supabase';
import { HMB_HOTEL_INFO, VAT_RATE, ACCOMMODATION_TAX_RATE } from '@/constants/hmbHotel';
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
  guests: { full_name: string; id_number: string | null; id_type: string | null }[];
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
      'id, full_name, id_number, id_type, check_in_at, check_out_at, status, room_id, total_amount_net, vat_amount, accommodation_tax_amount, rooms(room_number, price_per_night)'
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** PDF için HTML üret (expo-print ile kullanılır) */
export function buildHmbReportHtml(
  data: HmbReportData,
  filters: HmbReportFilters,
  authorizedName: string
): string {
  const reportDate = format(parseISO(data.generatedAt), 'd MMMM yyyy', { locale: tr });
  const reportTime = format(parseISO(data.generatedAt), 'HH:mm', { locale: tr });
  const period = `${shortDate(filters.startDate)} - ${shortDate(filters.endDate)}`;
  const totalAll =
    data.totalRevenueNet + data.totalVat + data.totalAccommodationTax;

  const rows = data.stays
    .map(
      (s) => `
    <tr>
      <td>${escapeHtml(s.room_number)}</td>
      <td>${s.guests.map((g) => escapeHtml(g.full_name)).join('<br/>')}</td>
      <td>${s.guests.map((g) => escapeHtml(g.id_number ?? '—')).join('<br/>')}</td>
      <td>${shortDate(s.check_in_at)}</td>
      <td>${s.check_out_at ? shortDate(s.check_out_at) : '—'}</td>
      <td>${fmtMoney(s.total_net)} TL (${s.nights} gece)<br/>KDV: ${fmtMoney(s.vat)} TL · KV: ${fmtMoney(s.accommodation_tax)} TL</td>
    </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; color: #1a202c; font-size: 11px; line-height: 1.4; }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #1e293b; }
    .header h1 { font-size: 14px; margin: 0 0 4px 0; color: #0f172a; }
    .header h2 { font-size: 12px; font-weight: 600; color: #334155; margin: 0; }
    .header p { font-size: 10px; color: #64748b; margin: 4px 0 0 0; }
    .block { margin-bottom: 16px; }
    .block h3 { font-size: 11px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; }
    .block p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; font-size: 10px; }
    .summary { background: #f8fafc; padding: 12px; border-radius: 8px; margin-top: 16px; }
    .summary p { margin: 4px 0; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center; }
    .signature { margin-top: 24px; }
    .signature-line { border-bottom: 1px solid #1a202c; width: 200px; margin-top: 32px; padding-bottom: 4px; font-size: 10px; color: #64748b; }
    .signature-name { font-weight: 600; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>T.C.<br/>HAZİNE VE MALİYE BAKANLIĞI</h1>
    <h2>GÜNLÜK MÜŞTERİ LİSTESİ</h2>
    <p>(Vergi Usul Kanunu Md. 240 gereğince düzenlenmiştir)</p>
  </div>

  <div class="block">
    <h3>İŞLETME BİLGİLERİ</h3>
    <p><strong>Ünvan</strong>: ${escapeHtml(HMB_HOTEL_INFO.title)}</p>
    <p><strong>Adres</strong>: ${escapeHtml(HMB_HOTEL_INFO.address)}</p>
    <p><strong>Vergi Dairesi</strong>: ${escapeHtml(HMB_HOTEL_INFO.taxOffice)}</p>
    <p><strong>Vergi Numarası</strong>: ${escapeHtml(HMB_HOTEL_INFO.taxNumber)}</p>
    <p><strong>Ticaret Sicil No</strong>: ${escapeHtml(HMB_HOTEL_INFO.tradeRegister)}</p>
    <p><strong>Telefon</strong>: ${escapeHtml(HMB_HOTEL_INFO.phone)}</p>
    <p><strong>E-posta</strong>: ${escapeHtml(HMB_HOTEL_INFO.email)}</p>
  </div>

  <div class="block">
    <h3>RAPOR DETAYLARI</h3>
    <p><strong>Rapor Tarihi</strong>: ${reportDate}</p>
    <p><strong>Rapor Saati</strong>: ${reportTime}</p>
    <p><strong>Dönem</strong>: ${period}</p>
    <p><strong>Rapor No</strong>: ${escapeHtml(data.reportNumber)}</p>
    <p><strong>Düzenleyen</strong>: ${escapeHtml(authorizedName)}</p>
  </div>

  <div class="block">
    <h3>MÜŞTERİ KONAKLAMA LİSTESİ</h3>
    <table>
      <thead>
        <tr>
          <th>ODA</th>
          <th>MÜŞTERİ ADI</th>
          <th>TC/PASAPORT</th>
          <th>GİRİŞ</th>
          <th>ÇIKIŞ</th>
          <th>ÜCRET / KDV / KV</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6">Kayıt yok.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="summary">
    <h3>ÖZET</h3>
    <p>Toplam Konaklama Sayısı: ${data.totalStays}</p>
    <p>Toplam Müşteri Sayısı: ${data.totalGuests}</p>
    <p>Toplam Gece Sayısı: ${data.totalNights}</p>
    <p>Toplam Konaklama Bedeli: ${fmtMoney(data.totalRevenueNet)} TL</p>
    <p>Toplam KDV (%10): ${fmtMoney(data.totalVat)} TL</p>
    <p>Toplam Konaklama Vergisi (%2): ${fmtMoney(data.totalAccommodationTax)} TL</p>
    <p><strong>GENEL TOPLAM: ${fmtMoney(totalAll)} TL</strong></p>
  </div>

  <div class="signature">
    <div class="signature-line">(Kaşe ve İmza)</div>
    <div class="signature-name">${escapeHtml(authorizedName)}</div>
    <div style="font-size: 10px; color: #64748b;">${escapeHtml(HMB_HOTEL_INFO.authorizedTitle)}</div>
  </div>

  <div class="footer">
    Bu belge, Vergi Usul Kanunu'nun 240. maddesi gereğince düzenlenmiş resmî bir evraktır. İbrazı zorunludur.
  </div>
</body>
</html>`;
}
