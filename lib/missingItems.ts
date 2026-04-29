import { supabase } from '@/lib/supabase';

export type MissingItemPriority = 'low' | 'medium' | 'high';
export type MissingItemStatus = 'open' | 'resolved';

export type MissingItemRow = {
  id: string;
  title: string;
  description: string | null;
  priority: MissingItemPriority;
  status: MissingItemStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  reminder_count: number;
  created_by_staff_id: string;
  resolved_by_staff_id: string | null;
  creator?: { full_name: string | null } | null;
  resolver?: { full_name: string | null } | null;
};

export async function listMissingItems(status: MissingItemStatus): Promise<{ data: MissingItemRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('missing_items')
    .select(
      `
      id,
      title,
      description,
      priority,
      status,
      created_at,
      updated_at,
      resolved_at,
      reminder_count,
      created_by_staff_id,
      resolved_by_staff_id,
      creator:staff!missing_items_created_by_staff_id_fkey(full_name),
      resolver:staff!missing_items_resolved_by_staff_id_fkey(full_name)
    `
    )
    .eq('status', status)
    .order(status === 'open' ? 'created_at' : 'resolved_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as MissingItemRow[] };
}

export async function createMissingItem(params: {
  staffId: string;
  organizationId: string;
  title: string;
  description?: string;
  priority?: MissingItemPriority;
}): Promise<{ error?: string }> {
  const title = params.title.trim();
  if (!title) return { error: 'Eksik basligi gerekli.' };

  const { error } = await supabase.from('missing_items').insert({
    organization_id: params.organizationId,
    created_by_staff_id: params.staffId,
    title,
    description: params.description?.trim() || null,
    priority: params.priority ?? 'medium',
  });
  return error ? { error: error.message } : {};
}

export async function resolveMissingItem(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('missing_items').update({ status: 'resolved' }).eq('id', id).eq('status', 'open');
  return error ? { error: error.message } : {};
}
