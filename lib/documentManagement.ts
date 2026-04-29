import { supabase } from '@/lib/supabase';

export type DocVisibility = 'public' | 'department' | 'authorized' | 'admin_only' | 'related_staff_only';
export type DocStatus = 'draft' | 'pending_approval' | 'active' | 'rejected' | 'expiring_soon' | 'expired' | 'archived';

export type DocumentCategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  requires_approval: boolean;
  is_active: boolean;
};

export type DocumentRow = {
  id: string;
  title: string;
  category_id: string;
  description: string | null;
  is_maliye_visible?: boolean;
  maliye_section_id?: string | null;
  maliye_display_order?: number;
  visibility: DocVisibility;
  status: DocStatus;
  document_date: string;
  expiry_date: string | null;
  current_version_id: string | null;
  uploaded_by_staff_id: string | null;
  /** Populated when select embeds uploader:staff!uploaded_by_staff_id */
  uploader?: { full_name: string | null } | { full_name: string | null }[] | null;
  approved_by_staff_id: string | null;
  rejected_reason: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentVersionRow = {
  id: string;
  document_id: string;
  version_no: number;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by_staff_id: string | null;
  note: string | null;
  created_at: string;
};

export async function listDocumentCategories() {
  return await supabase
    .from('document_categories')
    .select('id, parent_id, name, description, requires_approval, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });
}

export async function upsertDocumentCategory(args: {
  id?: string;
  organizationId?: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  requiresApproval?: boolean;
  isActive?: boolean;
}) {
  const payload: any = {
    organization_id: args.organizationId,
    parent_id: args.parentId ?? null,
    name: args.name.trim(),
    description: args.description ?? null,
    requires_approval: args.requiresApproval ?? false,
    is_active: args.isActive ?? true,
  };
  if (args.id) payload.id = args.id;
  return await supabase.from('document_categories').upsert(payload).select('id').single();
}

export async function listDocuments(args: { status?: DocStatus; archived?: boolean; search?: string; categoryId?: string } = {}) {
  let q = supabase
    .from('documents')
    .select('id, title, category_id, description, is_maliye_visible, maliye_section_id, maliye_display_order, visibility, status, document_date, expiry_date, current_version_id, uploaded_by_staff_id, approved_by_staff_id, rejected_reason, archived_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (args.status) q = q.eq('status', args.status);
  if (args.categoryId) q = q.eq('category_id', args.categoryId);
  if (args.archived === true) q = q.not('archived_at', 'is', null);
  if (args.archived === false) q = q.is('archived_at', null);
  if (args.search && args.search.trim().length > 0) q = q.ilike('title', `%${args.search.trim()}%`);
  return await q;
}

export async function getDocumentWithVersions(id: string) {
  const docRes = await supabase
    .from('documents')
    .select(
      'id, title, category_id, description, is_maliye_visible, maliye_section_id, maliye_display_order, visibility, status, document_date, expiry_date, current_version_id, uploaded_by_staff_id, uploader:staff!uploaded_by_staff_id(full_name), approved_by_staff_id, rejected_reason, archived_at, created_at, updated_at'
    )
    .eq('id', id)
    .single();
  if (docRes.error) return { docRes, versionsRes: null as any };
  const versionsRes = await supabase
    .from('document_versions')
    .select('id, document_id, version_no, file_name, file_path, file_size, mime_type, uploaded_by_staff_id, note, created_at')
    .eq('document_id', id)
    .order('version_no', { ascending: false });
  return { docRes, versionsRes };
}

