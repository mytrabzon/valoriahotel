-- Giriş kodu olmadan mesajlaşma: Giriş yapan kullanıcı için e-posta ile misafir yoksa oluşturur, app_token döndürür.
-- Sadece authenticated kullanıcı kendi e-postası ile çağırabilir (giriş kodu artık istenmez).

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
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT g.id, g.app_token INTO v_guest_id, v_token
  FROM public.guests g
  WHERE lower(trim(g.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_guest_id IS NOT NULL THEN
    RETURN v_token;
  END IF;

  v_name := coalesce(nullif(trim(p_full_name), ''), split_part(trim(p_email), '@', 1));
  IF v_name = '' THEN
    v_name := 'Misafir';
  END IF;

  INSERT INTO public.guests (email, full_name, contract_lang, status)
  VALUES (lower(trim(p_email)), v_name, 'tr', 'pending')
  RETURNING id, app_token INTO v_guest_id, v_token;

  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_guest_app_token_by_email(TEXT, TEXT) IS
  'Giriş yapan kullanıcı için mesajlaşma: E-posta ile misafir varsa app_token döner; yoksa oluşturup döner. Giriş kodu istenmez.';

GRANT EXECUTE ON FUNCTION public.get_or_create_guest_app_token_by_email(TEXT, TEXT) TO authenticated;
