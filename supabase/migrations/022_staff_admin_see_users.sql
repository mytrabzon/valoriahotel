-- Admin'in tüm personeli ve kullanıcıları görebilmesi: RLS recursion olmadan.
-- current_user_is_staff_admin() staff tablosunu okuyordu -> policy staff'ta tekrar RLS tetikleniyordu.
-- Çözüm: Admin auth_id'lerini ayrı bir tabloda tutup policy'de sadece onu okuyoruz (staff'a sorgu yok).

-- 1. Admin auth_id önbellek tablosu (staff'tan bağımsız, recursion yok)
CREATE TABLE IF NOT EXISTS public.admin_auth_ids (
  auth_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.admin_auth_ids IS 'RLS recursion önlemek için: role=admin olan staff auth_id listesi. Staff policy bu tabloya bakar.';

-- 2. Mevcut admin'leri doldur
INSERT INTO public.admin_auth_ids (auth_id)
SELECT auth_id FROM public.staff WHERE role = 'admin' AND is_active = true
ON CONFLICT (auth_id) DO NOTHING;

-- 3. Staff'ta role/is_active değişince admin_auth_ids'i güncelle
CREATE OR REPLACE FUNCTION public.sync_admin_auth_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.admin_auth_ids WHERE auth_id = OLD.auth_id;
    RETURN OLD;
  END IF;

  IF NEW.role = 'admin' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'admin') AND COALESCE(NEW.is_active, true) THEN
    INSERT INTO public.admin_auth_ids (auth_id) VALUES (NEW.auth_id) ON CONFLICT (auth_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND (NEW.role IS DISTINCT FROM 'admin' OR NOT COALESCE(NEW.is_active, true)) THEN
    DELETE FROM public.admin_auth_ids WHERE auth_id = NEW.auth_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admin_auth_ids ON public.staff;
CREATE TRIGGER trg_sync_admin_auth_ids
  AFTER INSERT OR UPDATE OF role, is_active OR DELETE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_auth_ids();

-- 4. admin_auth_ids RLS: authenticated herkes okuyabilsin (policy'de kullanılıyor)
ALTER TABLE public.admin_auth_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_auth_ids_read_authenticated" ON public.admin_auth_ids;
CREATE POLICY "admin_auth_ids_read_authenticated" ON public.admin_auth_ids
  FOR SELECT TO authenticated USING (true);

-- INSERT/DELETE policy yok: sadece trigger (SECURITY DEFINER) yazar; authenticated sadece SELECT.

-- 5. Staff policy: admin tüm satırları görebilsin (recursion yok, admin_auth_ids okuyoruz)
DROP POLICY IF EXISTS "staff_admin_select_all" ON public.staff;
CREATE POLICY "staff_admin_select_all" ON public.staff
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_auth_ids WHERE auth_id = auth.uid())
  );

-- 6. Mevcut current_user_is_staff_admin fonksiyonunu da admin_auth_ids kullanacak şekilde güncelle (diğer yerler için tutarlılık)
CREATE OR REPLACE FUNCTION public.current_user_is_staff_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_auth_ids WHERE auth_id = auth.uid());
$$;
