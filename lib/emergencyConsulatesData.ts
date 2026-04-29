/**
 * Türkiye'deki büyükelçilik / başkonsolosluk telefonları (bilgilendirme amaçlı).
 * Görünen adlar: emergency.tsx modalında i18n dili; tr dışı dillerde İngilizce gösterilir.
 */
export type LocalizedLine = { tr: string; en: string };

export type ConsulateOffice = {
  label: LocalizedLine;
  /** E.164 veya + ile başlayan, tel: için normalize edilebilir string */
  phone: string;
};

export type ConsulateCountry = {
  id: string;
  /** Bayrak (emoji) */
  flag: string;
  name: LocalizedLine;
  /** Irak gibi birden fazla temsilcilik uyarısı */
  note?: LocalizedLine;
  offices: ConsulateOffice[];
};

function p(digits: string): string {
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export const EMERGENCY_CONSULATES: ConsulateCountry[] = [
  {
    id: 'saudi_arabia',
    flag: '🇸🇦',
    name: { tr: 'Suudi Arabistan', en: 'Saudi Arabia' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124685540') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902122819140') },
    ],
  },
  {
    id: 'oman',
    flag: '🇴🇲',
    name: { tr: 'Umman', en: 'Oman' },
    offices: [
      { label: { tr: 'İstanbul Fahri Konsolosluk', en: 'Istanbul — Honorary Consulate' }, phone: p('+902122308384') },
    ],
  },
  {
    id: 'iraq',
    flag: '🇮🇶',
    name: { tr: 'Irak', en: 'Iraq' },
    note: {
      tr: 'Irak’ın Türkiye’de birden fazla temsilciliği vardır (Ankara + İstanbul).',
      en: 'Iraq has multiple missions in Türkiye (Ankara and Istanbul).',
    },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124687421') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902122938742') },
    ],
  },
  {
    id: 'uae',
    flag: '🇦🇪',
    name: { tr: 'Birleşik Arap Emirlikleri', en: 'United Arab Emirates' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124901414') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902123178888') },
    ],
  },
  {
    id: 'qatar',
    flag: '🇶🇦',
    name: { tr: 'Katar', en: 'Qatar' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124461896') }],
  },
  {
    id: 'kuwait',
    flag: '🇰🇼',
    name: { tr: 'Kuveyt', en: 'Kuwait' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124919100') }],
  },
  {
    id: 'bahrain',
    flag: '🇧🇭',
    name: { tr: 'Bahreyn', en: 'Bahrain' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124380467') }],
  },
  {
    id: 'jordan',
    flag: '🇯🇴',
    name: { tr: 'Ürdün', en: 'Jordan' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124408260') }],
  },
  {
    id: 'lebanon',
    flag: '🇱🇧',
    name: { tr: 'Lübnan', en: 'Lebanon' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124465985') }],
  },
  {
    id: 'iran',
    flag: '🇮🇷',
    name: { tr: 'İran', en: 'Iran' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124682821') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902125138230') },
    ],
  },
  {
    id: 'palestine',
    flag: '🇵🇸',
    name: { tr: 'Filistin', en: 'Palestine' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124903546') }],
  },
  {
    id: 'egypt',
    flag: '🇪🇬',
    name: { tr: 'Mısır', en: 'Egypt' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124271025') }],
  },
  {
    id: 'israel',
    flag: '🇮🇱',
    name: { tr: 'İsrail', en: 'Israel' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124597500') }],
  },
  {
    id: 'libya',
    flag: '🇱🇾',
    name: { tr: 'Libya', en: 'Libya' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124460685') }],
  },
  {
    id: 'tunisia',
    flag: '🇹🇳',
    name: { tr: 'Tunus', en: 'Tunisia' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124463092') }],
  },
  {
    id: 'morocco',
    flag: '🇲🇦',
    name: { tr: 'Fas', en: 'Morocco' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124371020') }],
  },
  {
    id: 'algeria',
    flag: '🇩🇿',
    name: { tr: 'Cezayir', en: 'Algeria' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124687798') }],
  },
  {
    id: 'sudan',
    flag: '🇸🇩',
    name: { tr: 'Sudan', en: 'Sudan' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124685453') }],
  },
  {
    id: 'yemen',
    flag: '🇾🇪',
    name: { tr: 'Yemen', en: 'Yemen' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124410126') }],
  },
  {
    id: 'pakistan',
    flag: '🇵🇰',
    name: { tr: 'Pakistan', en: 'Pakistan' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124271410') }],
  },
  {
    id: 'afghanistan',
    flag: '🇦🇫',
    name: { tr: 'Afganistan', en: 'Afghanistan' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124271805') }],
  },
  {
    id: 'azerbaijan',
    flag: '🇦🇿',
    name: { tr: 'Azerbaycan', en: 'Azerbaijan' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124412003') }],
  },
  {
    id: 'georgia',
    flag: '🇬🇪',
    name: { tr: 'Gürcistan', en: 'Georgia' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124918000') }],
  },
  {
    id: 'kazakhstan',
    flag: '🇰🇿',
    name: { tr: 'Kazakistan', en: 'Kazakhstan' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124412125') }],
  },
  {
    id: 'uzbekistan',
    flag: '🇺🇿',
    name: { tr: 'Özbekistan', en: 'Uzbekistan' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124413871') }],
  },
  {
    id: 'russia',
    flag: '🇷🇺',
    name: { tr: 'Rusya', en: 'Russia' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124392122') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902122925101') },
      { label: { tr: 'Antalya Başkonsolosluk', en: 'Antalya — Consulate General' }, phone: p('+902422483202') },
      { label: { tr: 'Trabzon Başkonsolosluk', en: 'Trabzon — Consulate General' }, phone: p('+904623262600') },
    ],
  },
  {
    id: 'ukraine',
    flag: '🇺🇦',
    name: { tr: 'Ukrayna', en: 'Ukraine' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124405289') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902126622541') },
    ],
  },
  {
    id: 'germany',
    flag: '🇩🇪',
    name: { tr: 'Almanya', en: 'Germany' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124555100') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902123346100') },
    ],
  },
  {
    id: 'uk',
    flag: '🇬🇧',
    name: { tr: 'Birleşik Krallık', en: 'United Kingdom' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124553344') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902123346400') },
    ],
  },
  {
    id: 'usa',
    flag: '🇺🇸',
    name: { tr: 'ABD', en: 'United States' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124555555') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902123359000') },
    ],
  },
  {
    id: 'france',
    flag: '🇫🇷',
    name: { tr: 'Fransa', en: 'France' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124554545') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902123938100') },
    ],
  },
  {
    id: 'italy',
    flag: '🇮🇹',
    name: { tr: 'İtalya', en: 'Italy' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124574200') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902122431024') },
    ],
  },
  {
    id: 'spain',
    flag: '🇪🇸',
    name: { tr: 'İspanya', en: 'Spain' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124058800') }],
  },
  {
    id: 'netherlands',
    flag: '🇳🇱',
    name: { tr: 'Hollanda', en: 'Netherlands' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124091800') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902123932121') },
    ],
  },
  {
    id: 'china',
    flag: '🇨🇳',
    name: { tr: 'Çin', en: 'China' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124360628') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902122992636') },
    ],
  },
  {
    id: 'india',
    flag: '🇮🇳',
    name: { tr: 'Hindistan', en: 'India' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124382195') }],
  },
  {
    id: 'japan',
    flag: '🇯🇵',
    name: { tr: 'Japonya', en: 'Japan' },
    offices: [
      { label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124460500') },
      { label: { tr: 'İstanbul Başkonsolosluk', en: 'Istanbul — Consulate General' }, phone: p('+902123174600') },
    ],
  },
  {
    id: 'korea',
    flag: '🇰🇷',
    name: { tr: 'Güney Kore', en: 'South Korea' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124684826') }],
  },
  {
    id: 'serbia',
    flag: '🇷🇸',
    name: { tr: 'Sırbistan', en: 'Serbia' },
    offices: [{ label: { tr: 'Ankara Büyükelçilik', en: 'Ankara — Embassy' }, phone: p('+903124460818') }],
  },
];

export function isTurkishUi(lang: string | undefined): boolean {
  return (lang ?? '').toLowerCase().startsWith('tr');
}

export function consulateName(c: ConsulateCountry, lang: string | undefined): string {
  return isTurkishUi(lang) ? c.name.tr : c.name.en;
}

export function consulateLabel(line: { label: LocalizedLine }, lang: string | undefined): string {
  return isTurkishUi(lang) ? line.label.tr : line.label.en;
}

export function consulateNote(c: ConsulateCountry, lang: string | undefined): string | null {
  if (!c.note) return null;
  return isTurkishUi(lang) ? c.note.tr : c.note.en;
}

/** tel: URL — boşluk ve ayırıcıları kaldırır */
export function phoneToTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.length > 0) return `tel:+${digits.replace(/^0+/, '')}`;
  return 'tel:';
}

export function phoneDisplay(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('90')) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 10)} ${clean.slice(10)}`;
  }
  return phone;
}

export function filterConsulates(
  list: ConsulateCountry[],
  query: string,
  lang: string | undefined
): ConsulateCountry[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => {
    const name = consulateName(c, lang).toLowerCase();
    const note = c.note ? (isTurkishUi(lang) ? c.note.tr : c.note.en).toLowerCase() : '';
    const officesBlob = c.offices
      .map((o) => {
        const lab = (isTurkishUi(lang) ? o.label.tr : o.label.en).toLowerCase();
        const compact = o.phone.replace(/\D/g, '');
        return `${lab} ${compact} ${o.phone}`;
      })
      .join(' ');
    if (name.includes(q) || note.includes(q) || officesBlob.includes(q)) return true;
    if (q.replace(/\D/g, '').length >= 3) {
      const qDigits = q.replace(/\D/g, '');
      if (c.offices.some((o) => o.phone.replace(/\D/g, '').includes(qDigits))) return true;
    }
    return false;
  });
}
