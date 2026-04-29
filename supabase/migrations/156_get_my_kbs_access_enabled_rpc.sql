-- Mobil istemci ops şeması REST ile expose edilmediğinde PGRST106 alıyordu.
-- public RPC: yalnızca oturumdaki kullanıcının kendi ops.app_users satırındaki bayrağı döner.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_kbs_access_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, ops
AS $$
  SELECT COALESCE(
    (SELECT kbs_access_enabled FROM ops.app_users WHERE id = auth.uid()),
    true
  );
$$;

COMMENT ON FUNCTION public.get_my_kbs_access_enabled() IS
  'Oturum kullanıcısı için ops.app_users.kbs_access_enabled; satır yoksa true.';

REVOKE ALL ON FUNCTION public.get_my_kbs_access_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_kbs_access_enabled() TO authenticated;

COMMIT;
