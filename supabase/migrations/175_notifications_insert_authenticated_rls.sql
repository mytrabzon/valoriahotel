-- Feed beğeni/yorum: POST /rest/v1/notifications → 403 (PostgREST error=42501) düzeltmesi
--
-- (1) INSERT: RLS altında yalnızca dar politikalar varsa guest/staff eşleşmesi yetmeyebilir.
-- (2) RETURNING: insert?select=id kullanıldığında PostgREST INSERT...RETURNING yapar; dönen satır için
--     SELECT RLS de uygulanır. Başkasına giden bildirimi ekleyen kullanıcı o satırı okuyamaz → 403.
--     Uygulama tarafında insert sonrası select kaldırıldı (lib/notificationService.ts).
-- Bu migration: 005'teki gibi authenticated için permissive "notifications_insert" (WITH CHECK true).
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

COMMENT ON POLICY "notifications_insert" ON public.notifications IS
  'Oturum açmış herkes (authenticated) notifications INSERT yapabilir — feed beğeni/yorum ve diğer client tetikli bildirimler.';

-- Bazı projelerde 42501 RLS değil tablo GRANT eksikliğidir; idempotent.
GRANT INSERT ON TABLE public.notifications TO authenticated;
