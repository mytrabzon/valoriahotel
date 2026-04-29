-- Harden documents storage org parsing + replace INSERT policy (fixes false RLS failures on upload)

BEGIN;

-- More robust than split_part: extracts UUID after leading "org/"
CREATE OR REPLACE FUNCTION public.storage_org_id_from_path(p_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_segment text;
BEGIN
  IF p_name IS NULL OR p_name !~ '^org/[^/]+/' THEN
    RETURN NULL;
  END IF;

  v_segment := substring(p_name from '^org/([^/]+)/');

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
    OR public.staff_has_app_permission('dokuman_yukle')
  )
  AND (
    public.current_user_is_staff_admin()
    OR (
      public.storage_org_id_from_path(name) IS NOT NULL
      AND public.storage_org_id_from_path(name) = public.current_staff_organization_id()
    )
  )
);

COMMIT;
