-- Fix documents storage INSERT RLS when a user has multiple staff rows (same auth_id):
-- staff_has_app_permission() and current_staff_organization_id() each use LIMIT 1
-- without ORDER BY, so Postgres can pick different rows -> path org A but "current" org B.
-- Policy: admin_auth_ids admin bypasses; else require one staff row matching BOTH
-- dokuman_yukle and object path organization.

BEGIN;

CREATE OR REPLACE FUNCTION public.storage_normalize_object_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '/' FROM trim(coalesce(p_name, '')));
$$;

CREATE OR REPLACE FUNCTION public.storage_org_id_from_path(p_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_segment text;
BEGIN
  v_raw := public.storage_normalize_object_name(p_name);

  IF v_raw IS NULL OR v_raw = '' OR v_raw !~ '^org/[^/]+/' THEN
    RETURN NULL;
  END IF;

  v_segment := substring(v_raw from '^org/([^/]+)/');

  BEGIN
    RETURN v_segment::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$;

DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
CREATE POLICY "documents_bucket_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    public.current_user_is_staff_admin()
    OR EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND COALESCE(s.is_active, true) = true
        AND s.deleted_at IS NULL
        AND s.organization_id IS NOT NULL
        AND COALESCE((s.app_permissions->>'dokuman_yukle') = 'true', false) = true
        AND s.organization_id = public.storage_org_id_from_path(name)
    )
  )
);

COMMIT;
