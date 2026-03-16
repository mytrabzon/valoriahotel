-- Misafir Expo push token'ını app_token ile kaydet (anon/guest tarafından çağrılır)
CREATE OR REPLACE FUNCTION public.upsert_guest_push_token(p_app_token TEXT, p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
