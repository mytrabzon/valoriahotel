-- Eski uygulama: supabase-js insert().select('id') → PostgREST INSERT...RETURNING; dönen satır için
-- SELECT RLS gerekir. Alıcı başka kullanıcı olduğunda sadece "alıcı" politikaları yetersiz → 403/42501.
-- Çözüm: ekleyen supabase auth kullanıcısını satırda tut; ekleyen kendi eklediği satırı SELECT edebilsin (RETURNING 200).
--
-- inserted_by_auth_id sadece istemciden (authenticated) gelen satırlar için dolu; service role / Edge INSERT
-- genelde RLS'yi bypass eder; trigger NULL auth'ta sütunu NULL bırakır.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS inserted_by_auth_id uuid;

COMMENT ON COLUMN public.notifications.inserted_by_auth_id IS
  'Bildirimi PostgREST ile ekleyen auth.uid() (beğeni/yorum RETURNING RLS); Edge/service role’da null olabilir.';

CREATE OR REPLACE FUNCTION public.trg_set_notifications_inserted_by_auth()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Zorunlu: istemcinin sütun göndermesine güvenilmez, her zaman oturum kullanıcısı
  IF auth.uid() IS NOT NULL THEN
    NEW.inserted_by_auth_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_set_inserted_by ON public.notifications;
CREATE TRIGGER trg_notifications_set_inserted_by
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_notifications_inserted_by_auth();

DROP POLICY IF EXISTS "notifications_select_inserter" ON public.notifications;
CREATE POLICY "notifications_select_inserter" ON public.notifications
  FOR SELECT TO authenticated
  USING (inserted_by_auth_id = auth.uid());

COMMENT ON POLICY "notifications_select_inserter" ON public.notifications IS
  'INSERT...RETURNING: satırı ekleyen aynı oturumla okuyabilsin (başkasına giden beğeni/yorum bildirimi).';
