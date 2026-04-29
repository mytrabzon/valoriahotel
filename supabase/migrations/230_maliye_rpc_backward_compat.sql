BEGIN;

-- Backward compatibility for older app clients that still call:
-- rpc/create_maliye_access_token with expires_in (interval)
DROP FUNCTION IF EXISTS public.create_maliye_access_token(text, interval);
CREATE FUNCTION public.create_maliye_access_token(
  pin_input text,
  expires_in interval
)
RETURNS public.maliye_access_tokens
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.create_maliye_access_token(pin_input, (expires_in::text));
$$;

-- Also keep a no-second-arg variant for safety.
DROP FUNCTION IF EXISTS public.create_maliye_access_token(text);
CREATE FUNCTION public.create_maliye_access_token(
  pin_input text
)
RETURNS public.maliye_access_tokens
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.create_maliye_access_token(pin_input, '24 hours'::text);
$$;

-- Backward compatibility for fixed token RPC with old single-arg usage.
DROP FUNCTION IF EXISTS public.create_or_rotate_default_maliye_token(text);
CREATE FUNCTION public.create_or_rotate_default_maliye_token(
  pin_input text
)
RETURNS public.maliye_access_tokens
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.create_or_rotate_default_maliye_token(pin_input, '5 years'::text);
$$;

COMMIT;
