/**
 * VUK Md. 240 — klasik matbaa düzenine yakın günlük müşteri listesi (tek sayfa A4, tablo).
 */
import type { HmbFormBranding, HmbFormMeta } from '@/lib/hmbFormBranding';
import type { HmbReportData, HmbReportFilters } from '@/lib/hmbReport';

/** Döngüsel import önlemek için dar tip */
type StayGuest = {
  full_name: string;
  id_type: string | null;
  nationality: string | null;
};
type StayRowLite = {
  room_number: string;
  nights: number;
  guests: StayGuest[];
  total_net: number;
  vat: number;
  accommodation_tax: number;
};
import { ministrySealSvgWithProvince } from '@/lib/hmbMinistrySealSvg';
import { format, parseISO, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

const ROW_MIN = 28;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDateDisplay(s: string | undefined): string {
  if (!s) return '…/…/……';
  const d = parseISO(s);
  if (!isValid(d)) return escapeHtml(s);
  return format(d, 'dd.MM.yyyy', { locale: tr });
}

function guestNationalityLabel(nationality: string | null | undefined, idType: string | null | undefined): string {
  const n = (nationality ?? '').trim();
  if (n) return n;
  if (idType === 'tc') return 'T.C.';
  if (idType === 'passport') return '—';
  return '—';
}

type FlatRow = {
  room: string;
  name: string;
  nationality: string;
  dailyRate: number;
  totalGuestShare: number;
};

/** Günlük: brüt toplam / gece; kişi sütunu: brüt toplam / kişi sayısı */
function flattenRowsFixed(stays: StayRowLite[]): FlatRow[] {
  const out: FlatRow[] = [];
  for (const s of stays) {
    const nights = Math.max(1, s.nights);
    const guestCount = Math.max(1, s.guests.length);
    const totalGross = s.total_net + s.vat + s.accommodation_tax;
    const dailyGross = totalGross / nights;
    const share = totalGross / guestCount;
    for (const g of s.guests) {
      out.push({
        room: s.room_number,
        name: g.full_name,
        nationality: guestNationalityLabel(g.nationality, g.id_type),
        dailyRate: dailyGross,
        totalGuestShare: share,
      });
    }
  }
  return out;
}

export function buildHmbOfficialDailyListHtml(
  data: HmbReportData,
  filters: HmbReportFilters,
  authorizedName: string,
  branding: HmbFormBranding,
  formMeta: HmbFormMeta
): string {
  const flat = flattenRowsFixed(data.stays as StayRowLite[]);
  const sealSrc = branding.ministrySealDataUrl
    ? branding.ministrySealDataUrl
    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ministrySealSvgWithProvince(branding.provinceCode))}`;

  const rowsHtml: string[] = [];
  let seq = 0;
  for (const r of flat) {
    seq += 1;
    rowsHtml.push(`<tr>
      <td style="text-align:center">${seq}</td>
      <td style="text-align:center">${escapeHtml(r.room)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td style="text-align:center">${escapeHtml(r.nationality)}</td>
      <td style="text-align:right">${fmtMoney(r.dailyRate)}</td>
      <td style="text-align:right">${fmtMoney(r.totalGuestShare)}</td>
    </tr>`);
  }
  const pad = Math.max(0, ROW_MIN - flat.length);
  for (let i = 0; i < pad; i++) {
    rowsHtml.push(
      `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`
    );
  }

  const leftBlock = `
    <div style="font-size:8.5pt;line-height:1.25;">
      ${branding.logoDataUrl ? `<div style="margin-bottom:4px;"><img src="${escapeAttr(branding.logoDataUrl)}" style="max-height:52px;max-width:120px;" alt="" /></div>` : ''}
      <div style="font-weight:700;font-size:9.5pt;">${escapeHtml(branding.legalCompanyName)}</div>
      ${branding.businessActivities ? `<div style="font-size:8pt;margin-top:2px;">${escapeHtml(branding.businessActivities)}</div>` : ''}
      <div style="margin-top:6px;font-size:8.5pt;">${escapeHtml(branding.address)}</div>
      <div style="margin-top:4px;font-size:8.5pt;">Tel: ${escapeHtml(branding.phone)}${branding.fax ? ` · Faks: ${escapeHtml(branding.fax)}` : ''}</div>
    </div>`;

  const rightBlock = `
    <div style="font-size:8.5pt;line-height:1.55;text-align:right;">
      <div><strong>Tarih</strong> ${escapeHtml(formMeta.listDate)}</div>
      <div><strong>SERİ</strong> ${escapeHtml(formMeta.seri)} &nbsp; <strong>SIRA</strong> ${escapeHtml(formMeta.sira || '……')}</div>
      <div style="margin-top:6px;"><strong>Giriş Tarihi</strong> ${escapeHtml(formMeta.arrivalDate)}</div>
      <div><strong>Çıkış Tarihi</strong> ${escapeHtml(formMeta.departureDate)}</div>
    </div>`;

  const periodNote = `${fmtDateDisplay(filters.startDate)} – ${fmtDateDisplay(filters.endDate)}`;
  const footerSmall = branding.footerPrinterLine
    ? `<div style="font-size:6.5pt;color:#333;margin-top:8px;text-align:center;">${escapeHtml(branding.footerPrinterLine)}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #000;
      font-size: 9pt;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet { max-width: 180mm; margin: 0 auto; }
    .head-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .head-table td { vertical-align: top; padding: 2px 4px; }
    .seal-wrap { text-align: center; }
    .seal-wrap img { width: 92px; height: auto; display: inline-block; }
    .title {
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 10px 0 6px 0;
    }
    .block-line { font-size: 9pt; margin-bottom: 8px; }
    .data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .data-table th, .data-table td {
      border: 1px solid #000;
      padding: 3px 4px;
      vertical-align: middle;
      word-wrap: break-word;
    }
    .data-table th {
      font-size: 8pt;
      font-weight: 700;
      text-align: center;
      background: #fff;
    }
    .col-sira { width: 6%; }
    .col-oda { width: 9%; }
    .col-ad { width: 34%; }
    .col-uyruk { width: 14%; }
    .col-gun { width: 18%; }
    .col-top { width: 19%; }
    .foot-sig { margin-top: 14px; font-size: 8.5pt; }
  </style>
</head>
<body>
  <div class="sheet">
    <table class="head-table">
      <tr>
        <td style="width:34%;">${leftBlock}</td>
        <td style="width:32%;" class="seal-wrap">
          <img src="${escapeAttr(sealSrc)}" alt=""/>
        </td>
        <td style="width:34%;">${rightBlock}</td>
      </tr>
    </table>

    <div class="title">GÜNLÜK MÜŞTERİ LİSTESİ</div>
    <div class="block-line"><strong>BLOK</strong> (${escapeHtml(formMeta.block || '…………………………………………')})</div>

    <table class="data-table">
      <colgroup>
        <col class="col-sira"/><col class="col-oda"/><col class="col-ad"/><col class="col-uyruk"/><col class="col-gun"/><col class="col-top"/>
      </colgroup>
      <thead>
        <tr>
          <th>Sıra</th>
          <th>Oda No.</th>
          <th>Müşterinin Adı, Soyadı</th>
          <th>Uyruğu</th>
          <th>Günlük Ücreti</th>
          <th>Toplam Ücret</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml.join('')}
      </tbody>
    </table>

    <div class="foot-sig">
      <div>Dönem (filtre): ${escapeHtml(periodNote)} · Rapor no: ${escapeHtml(data.reportNumber)}</div>
      <div style="margin-top:6px;">Düzenleyen: ${escapeHtml(authorizedName)} · Üretim: ${escapeHtml(format(parseISO(data.generatedAt), "dd.MM.yyyy HH:mm", { locale: tr }))}</div>
      <div style="margin-top:14px;border-bottom:1px solid #000;width:220px;padding-top:20px;">İmza / Kaşe</div>
    </div>
    ${footerSmall}
  </div>
</body>
</html>`;
}
