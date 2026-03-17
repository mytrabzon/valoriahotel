-- Güvenlik: get_guest_app_token_by_email ve get_or_create_guest_app_token_by_email
-- sadece çağıran kullanıcının kendi e-postası için token döndürmeli / oluşturmalı.
-- Aksi halde herhangi bir authenticated kullanıcı başka birinin e-postası ile RPC çağırıp
-- o misafirin app_token'ını alabilirdi (mesajlaşmada kimlik taklidi).

CREATE OR REPLACE FUNCTION public.get_guest_app_token_by_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_caller_email TEXT;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  v_caller_email := lower(trim((auth.jwt() ->> 'email')));
  IF v_caller_email IS NULL OR v_caller_email = '' THEN
    RETURN NULL;
  END IF;
  IF lower(trim(p_email)) <> v_caller_email THEN
    RETURN NULL;
  END IF;

  SELECT g.app_token INTO v_token
  FROM public.guests g
  WHERE lower(trim(g.email)) = v_caller_email
  LIMIT 1;

  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.get_guest_app_token_by_email(TEXT) IS
  'E-posta ile giriş yapmış kullanıcı için mesajlaşma tokenı. Sadece JWT''deki e-posta ile eşleşen istek kabul edilir.';


CREATE OR REPLACE FUNCTION public.get_or_create_guest_app_token_by_email(p_email TEXT, p_full_name TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_guest_id UUID;
  v_name TEXT;
  v_caller_email TEXT;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  v_caller_email := lower(trim((auth.jwt() ->> 'email')));
  IF v_caller_email IS NULL OR v_caller_email = '' THEN
    RETURN NULL;
  END IF;
  IF lower(trim(p_email)) <> v_caller_email THEN
    RETURN NULL;
  END IF;

  SELECT g.id, g.app_token INTO v_guest_id, v_token
  FROM public.guests g
  WHERE lower(trim(g.email)) = v_caller_email
  LIMIT 1;

  IF v_guest_id IS NOT NULL THEN
    RETURN v_token;
  END IF;

  v_name := coalesce(nullif(trim(p_full_name), ''), split_part(trim(p_email), '@', 1));
  IF v_name = '' THEN
    v_name := 'Misafir';
  END IF;

  INSERT INTO public.guests (email, full_name, contract_lang, status)
  VALUES (v_caller_email, v_name, 'tr', 'pending')
  RETURNING id, app_token INTO v_guest_id, v_token;

  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_guest_app_token_by_email(TEXT, TEXT) IS
  'Giriş yapan kullanıcı için mesajlaşma: Sadece JWT e-postası ile misafir varsa app_token döner; yoksa oluşturup döner.';
