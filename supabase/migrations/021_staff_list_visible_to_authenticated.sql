-- Kullanıcıların (müşteri/personel) uygulamada personel listesini görebilmesi.
-- Önce: Sadece kendi satırı (staff_own) veya admin tümü (staff_admin_select_all) görüyordu;
--       müşteri ve personel listesi boş geliyordu.
-- Çözüm: Giriş yapmış herkes (authenticated) staff tablosunu SELECT edebilsin (liste için).
-- INSERT/UPDATE/DELETE hâlâ sadece staff_own ile (kendi satırı).

DROP POLICY IF EXISTS "staff_select_authenticated" ON public.staff;
CREATE POLICY "staff_select_authenticated" ON public.staff
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON POLICY "staff_select_authenticated" ON public.staff IS 'Müşteri ve personel uygulamasında personel listesinin görünmesi için: giriş yapmış herkes listeleyebilir.';
