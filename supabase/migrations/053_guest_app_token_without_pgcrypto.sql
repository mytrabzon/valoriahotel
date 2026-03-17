-- gen_random_bytes() pgcrypto gerektirir; bazı ortamlarda "function gen_random_bytes(integer) does not exist" (42883) alınır.
-- Trigger'ı uzantı kullanmadan rastgele hex token üretecek şekilde güncelliyoruz (md5 + random built-in).

CREATE OR REPLACE FUNCTION public.set_guest_app_token_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.app_token IS NULL THEN
    NEW.app_token := md5(random()::text || clock_timestamp()::text || random()::text)
      || md5(random()::text || clock_timestamp()::text);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_guest_app_token_on_insert() IS
  'Yeni misafir kaydında app_token yoksa 64 karakter hex atar. pgcrypto gerektirmez.';
