/** 10 dakikalık pencerelere göre gruplama: aynı penceredeki pasaportlar yan yana, pencere karışmaz */
export const MRZ_TEN_MIN_MS = 10 * 60 * 1000;

export function tenMinuteWindowStart(createdAtIso: string): number {
  const t = new Date(createdAtIso).getTime();
  return Math.floor(t / MRZ_TEN_MIN_MS) * MRZ_TEN_MIN_MS;
}

export type GroupedByTenMin<T> = { windowStart: number; items: T[] }[];

/**
 * Yeni en üstte; her grup içi de yeni en solda.
 */
export function groupRowsByTenMinuteWindow<T extends { created_at: string }>(rows: T[]): GroupedByTenMin<T> {
  const m = new Map<number, T[]>();
  for (const r of rows) {
    const w = tenMinuteWindowStart(r.created_at);
    if (!m.has(w)) m.set(w, []);
    m.get(w)!.push(r);
  }
  return Array.from(m.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([windowStart, items]) => ({
      windowStart,
      items: items.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    }));
}

export function formatWindowRangeTr(windowStart: number, locale: string): { label: string; from: Date; to: Date } {
  const from = new Date(windowStart);
  const to = new Date(windowStart + MRZ_TEN_MIN_MS);
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    from,
    to,
    label: `${fmt.format(from)} – ${fmt.format(to)}`,
  };
}
