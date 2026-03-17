-- Beğeni/yorum bildirimleri: personel, başka personelin staff_id'sine bildirim ekleyebilsin (feed için).
-- Mevcut notifications_staff_own FOR ALL, INSERT'ta sadece kendi staff_id'ne izin veriyordu.
-- Bu policy ile authenticated ve staff olan kullanıcı, herhangi bir staff_id'ye INSERT yapabilir.
DROP POLICY IF EXISTS "notifications_insert_staff_to_any_staff" ON public.notifications;
CREATE POLICY "notifications_insert_staff_to_any_staff" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid())
    AND (staff_id IS NOT NULL OR guest_id IS NOT NULL)
  );

COMMENT ON POLICY "notifications_insert_staff_to_any_staff" ON public.notifications IS
  'Personel akış beğeni/yorum bildirimi ekleyebilir (hedef staff_id veya guest_id herhangi biri olabilir).';
