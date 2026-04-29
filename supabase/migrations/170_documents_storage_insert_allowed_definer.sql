-- Storage INSERT policy: evaluate staff/org/permission inside SECURITY DEFINER.
-- Rationale: inline EXISTS on public.staff from storage.objects policies can still
-- fail in some hosted contexts; helper matches 169 logic but runs as definer and
-- grants EXECUTE so policy evaluation never hits missing privileges.

BEGIN;

CREATE OR REPLACE FUNCTION public.documents_storage_insert_allowed(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_staff_admin()
    OR EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND COALESCE(s.is_active, true) = true
        AND s.deleted_at IS NULL
        AND s.organization_id IS NOT NULL
        AND s.organization_id = public.storage_org_id_from_path(p_object_name)
        AND (
          COALESCE((s.app_permissions->>'dokuman_yukle') IN ('true', 't', '1', 'TRUE', 'True'), false)
          OR (s.app_permissions->'dokuman_yukle') = 'true'::jsonb
        )
    );
$$;

REVOKE ALL ON FUNCTION public.documents_storage_insert_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.documents_storage_insert_allowed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documents_storage_insert_allowed(text) TO service_role;

DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
CREATE POLICY "documents_bucket_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.documents_storage_insert_allowed(name)
);

COMMIT;
