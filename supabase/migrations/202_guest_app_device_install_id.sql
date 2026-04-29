-- Misafir (anonim) uygulama girişi: cihaz kurulumu başına tek guest satırı.
-- Çıkış → tekrar "Misafir olarak giriş" yeni anonim auth uid üretse bile app_device_install_id ile aynı misafir kaydı eşleşir.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS app_device_install_id TEXT;

COMMENT ON COLUMN public.guests.app_device_install_id IS
  'Uygulama kurulumu başına cihaz kimliği; anonim misafir tekrar girişte aynı guests satırına bağlanır.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_app_device_install_id_unique
  ON public.guests (app_device_install_id)
  WHERE app_device_install_id IS NOT NULL AND btrim(app_device_install_id) <> '';

-- Önceki tek argümanlı sürüm (cihaz eşleşmesi yok); iki argümanlı sürüme devreder
DROP FUNCTION IF EXISTS public.get_or_create_guest_for_caller(TEXT);

CREATE OR REPLACE FUNCTION public.get_or_create_guest_for_caller(
  p_full_name TEXT DEFAULT NULL,
  p_device_install_id TEXT DEFAULT NULL
)
RETURNS TABLE(guest_id UUID, app_token TEXT, is_new BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_token TEXT;
  v_guest_id UUID;
  v_caller_email TEXT;
  v_name TEXT;
  v_is_anon BOOLEAN;
  v_auto_email TEXT;
  v_is_new BOOLEAN := false;
  v_device TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_caller_email := auth.jwt() ->> 'email';
  IF v_caller_email IS NOT NULL AND trim(v_caller_email) <> '' THEN
    v_caller_email := lower(trim(v_caller_email));
  ELSE
    v_caller_email := NULL;
  END IF;

  v_is_anon := coalesce((auth.jwt() ->> 'is_anonymous') = 'true', false);

  v_device := nullif(btrim(p_device_install_id), '');
  IF v_device IS NOT NULL AND length(v_device) < 8 THEN
    v_device := NULL;
  END IF;

  -- 1) E-posta ile mevcut misafir (silinmiş hariç)
  IF v_caller_email IS NOT NULL THEN
    SELECT g.id, g.app_token INTO v_guest_id, v_token
    FROM public.guests g
    WHERE lower(trim(g.email)) = v_caller_email AND g.deleted_at IS NULL
    LIMIT 1;
    IF v_guest_id IS NOT NULL THEN
      UPDATE public.guests SET auth_user_id = v_uid WHERE id = v_guest_id AND (auth_user_id IS NULL OR auth_user_id = v_uid);
      guest_id := v_guest_id;
      app_token := v_token;
      is_new := false;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- 2) Auth user id ile mevcut (silinmiş değilse)
  SELECT g.id, g.app_token INTO v_guest_id, v_token
  FROM public.guests g
  WHERE g.auth_user_id = v_uid AND g.deleted_at IS NULL
  LIMIT 1;
  IF v_guest_id IS NOT NULL THEN
    IF v_caller_email IS NOT NULL THEN
      UPDATE public.guests SET email = v_caller_email WHERE id = v_guest_id AND (email IS NULL OR trim(email) = '');
    END IF;
    -- Aynı oturumda cihaz kimliği ilk kez kaydedilebilsin
    IF v_is_anon AND v_device IS NOT NULL THEN
      UPDATE public.guests
      SET app_device_install_id = coalesce(nullif(btrim(app_device_install_id), ''), v_device),
          updated_at = now()
      WHERE id = v_guest_id
        AND (app_device_install_id IS NULL OR btrim(app_device_install_id) = '');
    END IF;
    guest_id := v_guest_id;
    app_token := v_token;
    is_new := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2b) Anonim + cihaz kimliği: bu cihazdaki (silinmiş/banlı dahil) misafir satırını yeni auth uid’ye bağla
  IF v_is_anon AND v_device IS NOT NULL THEN
    SELECT g.id, g.app_token INTO v_guest_id, v_token
    FROM public.guests g
    WHERE g.app_device_install_id = v_device
    LIMIT 1;
    IF v_guest_id IS NOT NULL THEN
      UPDATE public.guests
      SET auth_user_id = v_uid,
          updated_at = now()
      WHERE id = v_guest_id;
      guest_id := v_guest_id;
      app_token := v_token;
      is_new := false;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Aynı auth_user_id ile silinmiş kayıt varsa bağ koparılsın
  UPDATE public.guests SET auth_user_id = NULL WHERE auth_user_id = v_uid AND deleted_at IS NOT NULL;

  -- 3) Yeni misafir
  v_name := coalesce(nullif(trim(p_full_name), ''), 'Misafir');
  IF v_caller_email IS NOT NULL THEN
    v_name := coalesce(nullif(trim(p_full_name), ''), split_part(v_caller_email, '@', 1), 'Misafir');
  END IF;
  IF v_is_anon THEN
    v_name := 'Misafir';
    v_auto_email := 'guest_' || replace(gen_random_uuid()::text, '-', '') || '@valoria.guest';
  ELSE
    v_auto_email := v_caller_email;
  END IF;
  IF v_name = '' THEN
    v_name := 'Misafir';
  END IF;

  INSERT INTO public.guests (
    email,
    full_name,
    contract_lang,
    status,
    auth_user_id,
    is_guest_app_account,
    app_device_install_id
  )
  VALUES (
    coalesce(v_auto_email, v_caller_email),
    v_name,
    'tr',
    'pending',
    v_uid,
    v_is_anon,
    CASE WHEN v_is_anon AND v_device IS NOT NULL THEN v_device ELSE NULL END
  )
  RETURNING public.guests.id, public.guests.app_token INTO v_guest_id, v_token;

  v_is_new := true;
  guest_id := v_guest_id;
  app_token := v_token;
  is_new := v_is_new;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_guest_for_caller(TEXT, TEXT) IS
  'Çağıran için misafir: e-posta, auth_user_id, anonim+cihaz kimliği veya yeni kayıt. p_device_install_id sadece anonim misafir uygulama girişinde (SecureStore) gönderilir.';

GRANT EXECUTE ON FUNCTION public.get_or_create_guest_for_caller(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_guest_for_caller(TEXT, TEXT) TO anon;

-- SQL/edge uyumluluk: get_or_create_guest_for_caller(NULL) tek argüman
CREATE OR REPLACE FUNCTION public.get_or_create_guest_for_caller(p_full_name TEXT DEFAULT NULL)
RETURNS TABLE(guest_id UUID, app_token TEXT, is_new BOOLEAN)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.get_or_create_guest_for_caller(p_full_name, NULL::text);
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_guest_for_caller(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_guest_for_caller(TEXT) TO anon;

-- Misafir durumu: yönetici gerekçe alanları
DROP FUNCTION IF EXISTS public.get_my_guest_status();
CREATE OR REPLACE FUNCTION public.get_my_guest_status()
RETURNS TABLE(
  guest_id UUID,
  deleted_at TIMESTAMPTZ,
  banned_until TIMESTAMPTZ,
  ban_reason TEXT,
  deletion_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_email := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  RETURN QUERY
  SELECT g.id, g.deleted_at, g.banned_until, g.ban_reason, g.deletion_reason
  FROM public.guests g
  WHERE (g.auth_user_id = v_uid)
     OR (v_email IS NOT NULL AND g.email IS NOT NULL AND lower(trim(g.email)) = v_email)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_guest_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_guest_status() TO anon;

COMMENT ON FUNCTION public.get_my_guest_status() IS 'Çağıranın misafir satırı: silinme, ban, gerekçe metinleri.';
