import type { TFunction } from 'i18next';

/**
 * OSRM rota süresi; osrm.ts içindeki sabit Türkçe (dk, sa) yerine i18n kullanır.
 */
export function formatRouteDurationI18n(t: TFunction, seconds: number): string {
  if (seconds < 60) return t('diningVenuesRouteDurationUnder1');
  const mins = Math.round(seconds / 60);
  if (mins < 60) return t('diningVenuesRouteDurationMins', { n: mins });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m) return t('diningVenuesRouteDurationHoursMins', { h, m });
  return t('diningVenuesRouteDurationHoursOnly', { h });
}

/**
 * Rota mesafesi; mevcut i18n metre/km biçimlerini kullanır.
 */
export function formatRouteDistanceI18n(t: TFunction, meters: number): string {
  if (meters < 1000) return t('diningVenuesMeters', { m: Math.round(meters) });
  return t('diningVenuesKm', { n: (meters / 1000).toFixed(1) });
}
