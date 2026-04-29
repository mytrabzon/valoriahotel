import { supabase } from '@/lib/supabase';

export type StaffMentionCandidate = {
  id: string;
  full_name: string | null;
};

let cacheAt = 0;
let cacheRows: StaffMentionCandidate[] = [];

function normalizeToken(v: string): string {
  return v.trim().toLocaleLowerCase('tr-TR');
}

function extractMentionTokens(text: string): string[] {
  const out = new Set<string>();
  const re = /@([\p{L}\p{N}_.-]{2,32})/gu;
  let m: RegExpExecArray | null = re.exec(text);
  while (m) {
    const t = normalizeToken(m[1] ?? '');
    if (t.length >= 2) out.add(t);
    m = re.exec(text);
  }
  return Array.from(out);
}

function matchesByToken(fullName: string, token: string): boolean {
  if (!fullName || !token) return false;
  const n = normalizeToken(fullName);
  if (n.startsWith(token)) return true;
  return n.split(/\s+/).some((part) => part.startsWith(token));
}

async function listActiveStaffForMentions(): Promise<StaffMentionCandidate[]> {
  const now = Date.now();
  if (now - cacheAt < 60_000 && cacheRows.length > 0) return cacheRows;
  const { data } = await supabase
    .from('staff')
    .select('id, full_name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(700);
  cacheRows = (data ?? []) as StaffMentionCandidate[];
  cacheAt = now;
  return cacheRows;
}

export async function searchStaffMentionCandidates(query: string, limit = 8): Promise<StaffMentionCandidate[]> {
  const q = normalizeToken(query);
  const rows = await listActiveStaffForMentions();
  const sorted = rows
    .filter((r) => !!r.full_name)
    .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'tr'));
  const out = (q ? sorted.filter((r) => matchesByToken(r.full_name as string, q)) : sorted)
    .slice(0, Math.max(1, limit));
  return out;
}

export async function resolveMentionedStaffIdsFromText(
  text: string,
  options?: { excludeStaffId?: string | null }
): Promise<string[]> {
  const tokens = extractMentionTokens(text);
  if (tokens.length === 0) return [];
  const exclude = options?.excludeStaffId ?? null;
  const staffRows = await listActiveStaffForMentions();
  const ids = new Set<string>();
  for (const row of staffRows) {
    if (!row.id || row.id === exclude || !row.full_name) continue;
    if (tokens.some((token) => matchesByToken(row.full_name as string, token))) {
      ids.add(row.id);
    }
  }
  return Array.from(ids);
}
