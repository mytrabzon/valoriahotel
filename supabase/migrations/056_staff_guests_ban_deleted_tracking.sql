-- Ban, silme (soft delete) ve cihaz/IP takibi. Admin: şifre değiştir, ban (süreli), sil; banlanan/silinen kullanıcı lobiye döner.

-- ========== STAFF ==========
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_device_id TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

COMMENT ON COLUMN public.staff.banned_until IS 'Bu tarihe kadar banlı; null ise ban yok';
COMMENT ON COLUMN public.staff.last_login_device_id IS 'Son giriş cihaz ID (aynı cihazdan silinen/banlı eşleşmesi için)';

-- ========== GUESTS ==========
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_login_device_id TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- guests zaten ip_address ve device_info (001) var; last_login_* güncel tutulacak

-- ========== Personel yüklemede banned/deleted dahil (admin ve layout kontrolü için) ==========
-- RLS değişikliği yok; admin tüm staff/guests görür (022 vb.). Uygulama tarafında banned_until/deleted_at kontrol edilir.

-- ========== Misafir durumu: çağıran kullanıcının guest deleted/banned mi ==========
CREATE OR REPLACE FUNCTION public.get_my_guest_status()
RETURNS TABLE(guest_id UUID, deleted_at TIMESTAMPTZ, banned_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_email := lower(trim(auth.jwt() ->> 'email'));
  RETURN QUERY
  SELECT g.id, g.deleted_at, g.banned_until
  FROM public.guests g
  WHERE (g.auth_user_id = v_uid)
     OR (v_email IS NOT NULL AND g.email IS NOT NULL AND lower(trim(g.email)) = v_email)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_guest_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_guest_status() TO anon;

COMMENT ON FUNCTION public.get_my_guest_status IS 'Çağıran kullanıcının misafir kaydının silindi/banlı durumu';

-- Admin: staff ve guests için ban/deleted alanlarını güncelleyebilsin
DROP POLICY IF EXISTS "staff_admin_update_ban_deleted" ON public.staff;
CREATE POLICY "staff_admin_update_ban_deleted" ON public.staff FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin' AND s.is_active = true))
  WITH CHECK (true);

DROP POLICY IF EXISTS "guests_admin_update_ban_deleted" ON public.guests;
CREATE POLICY "guests_admin_update_ban_deleted" ON public.guests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin' AND s.is_active = true))
  WITH CHECK (true);
