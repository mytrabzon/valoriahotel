-- Staff tablosunda "staff_admin_select_all" politikası staff'a tekrar sorgu atıyor,
-- RLS tekrar tetikleniyor -> infinite recursion (42P17).
-- Çözüm: Admin kontrolü için RLS bypass eden bir fonksiyon kullan.

CREATE OR REPLACE FUNCTION public.current_user_is_staff_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_id = auth.uid() AND s.role = 'admin'
  );
$$;

-- Eski politikayı kaldırıp fonksiyon kullanan yeni politikayı ekle
DROP POLICY IF EXISTS "staff_admin_select_all" ON public.staff;
CREATE POLICY "staff_admin_select_all" ON public.staff
  FOR SELECT TO authenticated
  USING (public.current_user_is_staff_admin());
