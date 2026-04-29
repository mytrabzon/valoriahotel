-- upsert_*_push_token: SECURITY DEFINER içinde RLS, auth.uid() ile uyuşmazsa INSERT 42501 verebiliyor.
-- Oturum çağıranı korur, tablo yazımı definer yolunda RLS devre dışı (içerik hâlâ sadece ilgili staff/guest id).

CREATE OR REPLACE FUNCTION public.upsert_staff_push_token(p_token TEXT, p_device_info JSONB DEFAULT '{}'::JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN;
  END IF;
  SELECT id INTO v_staff_id FROM public.staff WHERE auth_id = auth.uid() LIMIT 1;
  IF v_staff_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.push_tokens (guest_id, staff_id, token, device_info)
  VALUES (NULL, v_staff_id, btrim(p_token), COALESCE(p_device_info, '{}'::JSONB))
  ON CONFLICT (token) DO UPDATE SET
    staff_id = EXCLUDED.staff_id,
    guest_id = NULL,
    device_info = EXCLUDED.device_info;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_guest_push_token(p_app_token TEXT, p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_guest_id UUID;
BEGIN
  IF p_app_token IS NULL OR p_token IS NULL OR trim(p_token) = '' THEN
    RETURN;
  END IF;
  SELECT id INTO v_guest_id FROM public.guests WHERE app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.push_tokens (guest_id, staff_id, token, device_info)
  VALUES (v_guest_id, NULL, p_token, '{}')
  ON CONFLICT (token) DO UPDATE SET
    guest_id = EXCLUDED.guest_id,
    staff_id = NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_staff_push_token(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_guest_push_token(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.upsert_staff_push_token(TEXT, JSONB) IS
  'Expo token kaydı; RLS definer yolunda kapatıldı (sadece auth.uid() ile eşleşen staff).';
COMMENT ON FUNCTION public.upsert_guest_push_token(TEXT, TEXT) IS
  'Misafir token kaydı; RLS definer yolunda kapatıldı (app_token ile eşleşen guest).';
