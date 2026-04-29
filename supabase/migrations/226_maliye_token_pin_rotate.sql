BEGIN;

CREATE OR REPLACE FUNCTION public.update_maliye_token_pin(
  target_token_id uuid,
  new_pin text
)
RETURNS public.maliye_access_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_salt text;
  v_row public.maliye_access_tokens;
BEGIN
  IF new_pin IS NULL OR char_length(trim(new_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN en az 4 karakter olmalı';
  END IF;

  IF NOT public.current_user_is_staff_admin() THEN
    RAISE EXCEPTION 'Sadece admin PIN değiştirebilir';
  END IF;

  v_org_id := public.current_staff_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organizasyon bulunamadı';
  END IF;

  SELECT *
    INTO v_row
    FROM public.maliye_access_tokens
   WHERE id = target_token_id
     AND organization_id = v_org_id
   LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Token bulunamadı';
  END IF;

  v_salt := encode(gen_random_bytes(16), 'hex');

  UPDATE public.maliye_access_tokens
     SET pin_salt = v_salt,
         pin_hash = public.maliye_hash_pin(new_pin, v_salt)
   WHERE id = target_token_id
  RETURNING * INTO v_row;

  INSERT INTO public.maliye_audit_logs (
    organization_id,
    token_id,
    event_type,
    success,
    metadata
  )
  VALUES (
    v_org_id,
    target_token_id,
    'pin.changed',
    true,
    jsonb_build_object('by', public.current_staff_id())
  );

  RETURN v_row;
END;
$$;

COMMIT;
