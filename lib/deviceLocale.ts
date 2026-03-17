/**
 * Cihaz dilini algılar ve uygulamanın desteklediği dil koduna (LangCode) eşler.
 * Desteklenmeyen diller için varsayılan: 'en'.
 * expo-localization native modülü yoksa (web / link edilmemiş build) varsayılan döner.
 */
import type { LangCode } from '@/i18n';

const SUPPORTED: Record<string, LangCode> = {
  tr: 'tr',
  en: 'en',
  ar: 'ar',
  de: 'de',
  fr: 'fr',
  ru: 'ru',
  es: 'es',
};

const DEFAULT_LANG: LangCode = 'en';

/**
 * Telefonun/cihazın tercih edilen dil kodunu döndürür.
 * Uygulamanın desteklediği dillerden biri değilse DEFAULT_LANG ('en') döner.
 */
export function getDeviceLanguageCode(): LangCode {
  try {
    const { getLocales } = require('expo-localization');
    const locales = getLocales();
    const first = locales?.[0];
    const code = first?.languageCode?.toLowerCase?.() ?? '';
    return SUPPORTED[code] ?? DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}
