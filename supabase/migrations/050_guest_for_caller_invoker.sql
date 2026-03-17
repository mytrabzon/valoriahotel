-- Apple (ve diğer OAuth) ile giriş: SECURITY DEFINER iken INSERT, RLS yüzünden
-- fonksiyon sahibi (postgres) için izinli değil; authenticated politikası var.
-- INVOKER yapınca çağıran kullanıcı (Apple ile giriş yapan authenticated) INSERT yapar, RLS izin verir.

CREATE OR REPLACE FUNCTION public.get_or_create_guest_for_caller(p_full_name TEXT DEFAULT NULL)
RETURNS TABLE(guest_id UUID, app_token TEXT)
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

  -- 1) E-posta ile mevcut misafir var mı?
  IF v_caller_email IS NOT NULL THEN
    SELECT g.id, g.app_token INTO v_guest_id, v_token
    FROM public.guests g
    WHERE lower(trim(g.email)) = v_caller_email
    LIMIT 1;
    IF v_guest_id IS NOT NULL THEN
      UPDATE public.guests SET auth_user_id = v_uid WHERE id = v_guest_id AND (auth_user_id IS NULL OR auth_user_id = v_uid);
      guest_id := v_guest_id;
      app_token := v_token;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- 2) Auth user id ile mevcut misafir var mı? (Apple: JWT'de email yok)
  SELECT g.id, g.app_token INTO v_guest_id, v_token
  FROM public.guests g
  WHERE g.auth_user_id = v_uid
  LIMIT 1;
  IF v_guest_id IS NOT NULL THEN
    IF v_caller_email IS NOT NULL THEN
      UPDATE public.guests SET email = v_caller_email WHERE id = v_guest_id AND (email IS NULL OR trim(email) = '');
    END IF;
    guest_id := v_guest_id;
    app_token := v_token;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 3) Yeni misafir oluştur (çağıran kullanıcı = authenticated, RLS izin verir)
  v_name := coalesce(nullif(trim(p_full_name), ''), 'Misafir');
  IF v_caller_email IS NOT NULL THEN
    v_name := coalesce(nullif(trim(p_full_name), ''), split_part(v_caller_email, '@', 1), 'Misafir');
  END IF;
  IF v_name = '' THEN
    v_name := 'Misafir';
  END IF;

  INSERT INTO public.guests (email, full_name, contract_lang, status, auth_user_id)
  VALUES (
    v_caller_email,
    v_name,
    'tr',
    'pending',
    v_uid
  )
  RETURNING public.guests.id, public.guests.app_token INTO v_guest_id, v_token;

  guest_id := v_guest_id;
  app_token := v_token;
  RETURN NEXT;
END;
$$;
