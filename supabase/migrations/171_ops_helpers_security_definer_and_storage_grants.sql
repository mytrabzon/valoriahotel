-- Storage API runs INSERT into storage.objects as role supabase_storage_admin.
-- SQL-language helpers (ops.current_hotel_id etc.) were SECURITY INVOKER; Postgres can
-- inline them into storage.objects RLS checks, so the subquery runs as storage_admin
-- -> "permission denied for schema ops".
-- Fix: mark ops tenant helpers SECURITY DEFINER; make documents upload helper plpgsql
-- (not flattened into one invoker plan); grant EXECUTE to supabase_storage_admin.

BEGIN;

-- ========== OPS: tenant context (must not require caller USAGE on schema ops) ==========

CREATE OR REPLACE FUNCTION ops.current_hotel_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ops, public
AS $$
  SELECT au.hotel_id
  FROM ops.app_users au
  WHERE au.id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION ops.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ops, public
AS $$
  SELECT au.role
  FROM ops.app_users au
  WHERE au.id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION ops.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ops, public
AS $$
  SELECT ops.current_role() = 'admin'
$$;

CREATE OR REPLACE FUNCTION ops.has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ops, public
AS $$
  SELECT
    CASE
      WHEN ops.is_admin() THEN true
      ELSE EXISTS (
        SELECT 1
        FROM ops.user_permissions up
        WHERE up.hotel_id = ops.current_hotel_id()
          AND up.user_id = auth.uid()
          AND up.permission_code = p_code
          AND up.is_allowed = true
      )
    END
$$;

-- ========== APP: documents bucket policy helper (plpgsql = no risky inlining) ==========

CREATE OR REPLACE FUNCTION public.documents_storage_insert_allowed(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_is_staff_admin() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
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
END;
$$;

REVOKE ALL ON FUNCTION public.documents_storage_insert_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.documents_storage_insert_allowed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documents_storage_insert_allowed(text) TO service_role;

DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    GRANT EXECUTE ON FUNCTION public.documents_storage_insert_allowed(text) TO supabase_storage_admin;
  END IF;
END
$g$;

REVOKE ALL ON FUNCTION ops.current_hotel_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION ops.current_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION ops.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION ops.has_permission(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION ops.current_hotel_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION ops.current_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION ops.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION ops.has_permission(text) TO authenticated, service_role;

DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    GRANT EXECUTE ON FUNCTION ops.current_hotel_id() TO supabase_storage_admin;
    GRANT EXECUTE ON FUNCTION ops.current_role() TO supabase_storage_admin;
    GRANT EXECUTE ON FUNCTION ops.is_admin() TO supabase_storage_admin;
    GRANT EXECUTE ON FUNCTION ops.has_permission(text) TO supabase_storage_admin;
  END IF;
END
$g$;

-- Policy unchanged (still calls helper); helper body replaced above.
DROP POLICY IF EXISTS "documents_bucket_insert" ON storage.objects;
CREATE POLICY "documents_bucket_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.documents_storage_insert_allowed(name)
);

COMMIT;
