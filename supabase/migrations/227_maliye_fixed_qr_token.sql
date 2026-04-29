BEGIN;

CREATE OR REPLACE FUNCTION public.create_or_rotate_default_maliye_token(
  pin_input text
)
RETURNS public.maliye_access_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_staff_id uuid;
  v_salt text;
  v_row public.maliye_access_tokens;
  v_fixed_token text := 'valoria-maliye-qr';
BEGIN
  IF pin_input IS NULL OR char_length(trim(pin_input)) < 4 THEN
    RAISE EXCEPTION 'PIN en az 4 karakter olmalı';
  END IF;

  IF NOT public.current_user_is_staff_admin() THEN
    RAISE EXCEPTION 'Sadece admin token üretebilir';
  END IF;

  v_org_id := public.current_staff_organization_id();
  v_staff_id := public.current_staff_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organizasyon bulunamadı';
  END IF;

  UPDATE public.maliye_access_tokens
     SET is_active = false
   WHERE organization_id = v_org_id
     AND token <> v_fixed_token;

  v_salt := encode(gen_random_bytes(16), 'hex');

  INSERT INTO public.maliye_access_tokens (
    organization_id,
    token,
    pin_salt,
    pin_hash,
    expires_at,
    is_active,
    created_by_staff_id
  )
  VALUES (
    v_org_id,
    v_fixed_token,
    v_salt,
    public.maliye_hash_pin(pin_input, v_salt),
    now() + interval '5 years',
    true,
    v_staff_id
  )
  ON CONFLICT (token)
  DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    pin_salt = EXCLUDED.pin_salt,
    pin_hash = EXCLUDED.pin_hash,
    expires_at = EXCLUDED.expires_at,
    is_active = true,
    created_by_staff_id = EXCLUDED.created_by_staff_id
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
    v_row.id,
    'token.fixed_qr_rotated',
    true,
    jsonb_build_object('token', v_fixed_token, 'expires_at', v_row.expires_at)
  );

  RETURN v_row;
END;
$$;

COMMIT;
