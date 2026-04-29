import type { Locale } from 'date-fns';
import { tr, enUS, ar, de, fr, ru, es } from 'date-fns/locale';
import i18n from '@/i18n';

/** `date-fns` locale for relative dates, aligned with app language. */
export function dateFnsLocaleForApp(): Locale {
  const c = (i18n.language || 'tr').split('-')[0];
  if (c === 'en') return enUS;
  if (c === 'ar') return ar;
  if (c === 'de') return de;
  if (c === 'fr') return fr;
  if (c === 'ru') return ru;
  if (c === 'es') return es;
  return tr;
}
