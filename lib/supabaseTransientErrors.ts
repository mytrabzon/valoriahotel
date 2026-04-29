/**
 * PostgREST geçici hatalar (PGRST002: schema cache, vb.) — kısa aralıklarla yeniden denemeye uygun.
 */
export function isPostgrestSchemaCacheError(
  e: { code?: string; message?: string } | null | undefined
): boolean {
  if (!e) return false;
  if (e.code === 'PGRST002') return true;
  const m = (e.message ?? '').toLowerCase();
  return m.includes('schema cache') && m.includes('retry');
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
