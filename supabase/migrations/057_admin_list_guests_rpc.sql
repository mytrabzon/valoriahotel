-- Admin panelinde misafir listesinin her zaman görünmesi: RLS bypass RPC.
-- Sadece admin_auth_ids içindeki kullanıcılar çağırabilir.

CREATE OR REPLACE FUNCTION public.admin_list_guests(p_filter text DEFAULT 'all')
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  email text,
  status text,
  created_at timestamptz,
  room_id uuid,
  room_number text,
  auth_user_id uuid,
  banned_until timestamptz,
  deleted_at timestamptz,
  last_login_device_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_auth_ids WHERE auth_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  RETURN QUERY
  SELECT
    g.id,
    g.full_name,
    g.phone,
    g.email,
    g.status,
    g.created_at,
    g.room_id,
    r.room_number::text,
    g.auth_user_id,
    g.banned_until,
    g.deleted_at,
    g.last_login_device_id
  FROM public.guests g
  LEFT JOIN public.rooms r ON r.id = g.room_id
  WHERE (p_filter IS NULL OR p_filter <> 'pending' OR g.status = 'pending')
  ORDER BY g.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_guests(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_guests(text) TO service_role;

COMMENT ON FUNCTION public.admin_list_guests(text) IS 'Admin paneli: tüm misafirleri listeler. Sadece admin rolündeki personel çağırabilir.';
