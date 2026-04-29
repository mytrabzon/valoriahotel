-- Relax documents bucket INSERT policy to avoid false RLS failures when org parsing/auth mapping edge-cases occur.
-- Still requires: authenticated + bucket_id=documents + (admin OR dokuman_yukle)

BEGIN;

CREATE OR REPLACE FUNCTION public.storage_org_id_from_path(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(split_part(p_name, '/', 2), '')::uuid;
$$;

DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
CREATE POLICY "documents_bucket_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('dokuman_yukle')
  )
  AND (
    public.current_user_is_staff_admin()
    OR public.storage_org_id_from_path(name) IS NULL
    OR public.storage_org_id_from_path(name) = public.current_staff_organization_id()
  )
);

COMMIT;
