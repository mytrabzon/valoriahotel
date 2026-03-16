/**
 * Tarih yardımcıları – date-fns ile TR locale
 */
import {
  format,
  formatDistanceToNow,
  parseISO,
  isValid,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  type Locale,
} from 'date-fns';
import { tr } from 'date-fns/locale';

export const dateLocale: Locale = tr;

/** ISO tarih string → Date (invalid ise null) */
export function parseDate(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

/** Tarih → "15 Mart 2025" */
export function formatDate(date: Date | string | null | undefined): string {
  const d = parseDate(typeof date === 'object' ? date?.toISOString?.() ?? '' : date);
  if (!d) return '—';
  return format(d, 'd MMMM yyyy', { locale: dateLocale });
}

/** Tarih → "15.03.2025" */
export function formatDateShort(date: Date | string | null | undefined): string {
  const d = parseDate(typeof date === 'object' ? date?.toISOString?.() ?? '' : date);
  if (!d) return '—';
  return format(d, 'dd.MM.yyyy', { locale: dateLocale });
}

/** Tarih + saat → "15 Mart 2025, 14:30" */
export function formatDateTime(date: Date | string | null | undefined): string {
  const d = parseDate(typeof date === 'object' ? date?.toISOString?.() ?? '' : date);
  if (!d) return '—';
  return format(d, "d MMMM yyyy, HH:mm", { locale: dateLocale });
}

/** Sadece saat → "14:30" */
export function formatTime(date: Date | string | null | undefined): string {
  const d = parseDate(typeof date === 'object' ? date?.toISOString?.() ?? '' : date);
  if (!d) return '—';
  return format(d, 'HH:mm', { locale: dateLocale });
}

/** "5 dakika önce" / "2 saat önce" (TR) */
export function formatRelative(date: Date | string | null | undefined, base = new Date()): string {
  const d = parseDate(typeof date === 'object' ? date?.toISOString?.() ?? '' : date);
  if (!d) return '—';
  return formatDistanceToNow(d, { addSuffix: true, locale: dateLocale });
}

/** Bugünün ISO tarih aralığı (00:00 - 23:59:59) */
export function todayISORange(): { start: string; end: string } {
  const start = startOfDay(new Date());
  const end = endOfDay(new Date());
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/** Verilen tarihe gün ekle/çıkar, ISO date string (YYYY-MM-DD) */
export function addDaysToDate(dateStr: string, delta: number): string {
  const d = parseISO(dateStr);
  const next = addDays(d, delta);
  return format(next, 'yyyy-MM-dd');
}

export { addDays, subDays, startOfDay, endOfDay, format, parseISO, isValid };
export { tr as dateFnsLocale };
