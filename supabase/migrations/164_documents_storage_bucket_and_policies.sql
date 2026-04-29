-- Storage bucket for document files + policies (organization-scoped paths)

BEGIN;

-- Bucket
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- Helper to parse organization_id from object name: org/<uuid>/documents/<docId>/...
CREATE OR REPLACE FUNCTION public.storage_org_id_from_path(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(split_part(p_name, '/', 2), '')::uuid;
$$;

-- RLS for storage.objects is enabled by default in Supabase; create policies.

-- SELECT: allow staff in same org (or admin)
DROP POLICY IF EXISTS "documents_bucket_read" ON storage.objects;
CREATE POLICY "documents_bucket_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.current_user_is_staff_admin()
    OR public.storage_org_id_from_path(name) = public.current_staff_organization_id()
  )
);

-- INSERT: admin or dokuman_yukle, and must upload inside own org folder
DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
CREATE POLICY "documents_bucket_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.storage_org_id_from_path(name) = public.current_staff_organization_id()
  AND (public.current_user_is_staff_admin() OR public.staff_has_app_permission('dokuman_yukle'))
);

-- UPDATE: admin only (avoid tampering)
DROP POLICY IF EXISTS "documents_bucket_update_admin" ON storage.objects;
CREATE POLICY "documents_bucket_update_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND public.current_user_is_staff_admin())
WITH CHECK (bucket_id = 'documents' AND public.current_user_is_staff_admin());

-- DELETE: admin only
DROP POLICY IF EXISTS "documents_bucket_delete_admin" ON storage.objects;
CREATE POLICY "documents_bucket_delete_admin"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND public.current_user_is_staff_admin());

COMMIT;

