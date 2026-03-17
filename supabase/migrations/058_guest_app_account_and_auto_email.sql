-- Misafir hesap (uygulama misafir girişi): cihaz başına bir hesap, otomatik e-posta, admin'de tanıma.
-- Anonymous auth ile giriş yapan kullanıcılar "misafir hesap" olarak işaretlenir; çıkış yapıp tekrar girişte aynı hesap, silinmişse yeni hesap.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS is_guest_app_account BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guests.is_guest_app_account IS 'Uygulama "Misafir olarak giriş" ile oluşturulmuş hesap; admin listesinde ayırt edilir.';
COMMENT ON COLUMN public.guests.welcome_email_sent_at IS 'Misafir hesap oluşturulduğunda admin bildirim e-postası gönderildi mi.';

-- get_or_create_guest_for_caller: silinmiş hesabı döndürme (yeni oluştur), anonymous ise is_guest_app_account + otomatik e-posta
CREATE OR REPLACE FUNCTION public.get_or_create_guest_for_caller(p_full_name TEXT DEFAULT NULL)
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

  -- 1) E-posta ile mevcut misafir var mı? (silinmiş olanları atla)
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

  -- 2) Auth user id ile mevcut misafir var mı? Silinmişse bağlantıyı kaldır ve yeni oluştur
  SELECT g.id, g.app_token INTO v_guest_id, v_token
  FROM public.guests g
  WHERE g.auth_user_id = v_uid AND g.deleted_at IS NULL
  LIMIT 1;
  IF v_guest_id IS NOT NULL THEN
    IF v_caller_email IS NOT NULL THEN
      UPDATE public.guests SET email = v_caller_email WHERE id = v_guest_id AND (email IS NULL OR trim(email) = '');
    END IF;
    guest_id := v_guest_id;
    app_token := v_token;
    is_new := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Aynı auth_user_id ile silinmiş kayıt varsa bağlantıyı kaldır (yeni hesap açılabilsin)
  UPDATE public.guests SET auth_user_id = NULL WHERE auth_user_id = v_uid AND deleted_at IS NOT NULL;

  -- 3) Yeni misafir oluştur
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
    is_guest_app_account
  )
  VALUES (
    coalesce(v_auto_email, v_caller_email),
    v_name,
    'tr',
    'pending',
    v_uid,
    v_is_anon
  )
  RETURNING public.guests.id, public.guests.app_token INTO v_guest_id, v_token;

  v_is_new := true;
  guest_id := v_guest_id;
  app_token := v_token;
  is_new := v_is_new;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_guest_for_caller(TEXT) IS
  'Çağıran kullanıcı için misafir: email/auth_user_id ile bulur veya oluşturur. Silinmiş hesap varsa yeni oluşturur. Anonymous = misafir hesap (otomatik e-posta atanır).';

-- admin_list_guests: is_guest_app_account döndür
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
  last_login_device_id text,
  is_guest_app_account boolean
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
    g.last_login_device_id,
    coalesce(g.is_guest_app_account, false)
  FROM public.guests g
  LEFT JOIN public.rooms r ON r.id = g.room_id
  WHERE (p_filter IS NULL OR p_filter <> 'pending' OR g.status = 'pending')
  ORDER BY g.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_guests(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_guests(text) TO service_role;
