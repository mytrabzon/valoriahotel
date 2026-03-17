-- Mesajlaşmada giriş kodunu atlamak: E-posta ile giriş yapmış kullanıcı için misafir app_token'ı döndür.
-- Uygulama bu RPC'yi sadece session.user.email ile çağırmalı (kendi e-postası).

CREATE OR REPLACE FUNCTION public.get_guest_app_token_by_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;
  SELECT g.app_token INTO v_token
  FROM public.guests g
  WHERE lower(trim(g.email)) = lower(trim(p_email))
  LIMIT 1;
  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.get_guest_app_token_by_email(TEXT) IS 'E-posta ile giriş yapmış kullanıcı için mesajlaşma tokenı; giriş kodu formu atlanabilir. Sadece kendi e-postası ile çağrılmalı.';

GRANT EXECUTE ON FUNCTION public.get_guest_app_token_by_email(TEXT) TO authenticated;
