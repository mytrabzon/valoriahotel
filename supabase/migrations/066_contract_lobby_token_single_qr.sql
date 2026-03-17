-- Tek QR ile sözleşme onayı: oda seçimi yok, token lobby tablosundan.
-- contract_lobby_tokens: tek bir QR'da kullanılacak token (room_id yok; onay sonrası çalışan oda atar).

CREATE TABLE IF NOT EXISTS public.contract_lobby_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_lobby_tokens_token ON public.contract_lobby_tokens(token);
CREATE INDEX IF NOT EXISTS idx_contract_lobby_tokens_expires ON public.contract_lobby_tokens(expires_at);

ALTER TABLE public.contract_lobby_tokens ENABLE ROW LEVEL SECURITY;

-- Sadece authenticated (admin panel) okuyabilsin / ekleyebilsin
DROP POLICY IF EXISTS "contract_lobby_tokens_authenticated" ON public.contract_lobby_tokens;
CREATE POLICY "contract_lobby_tokens_authenticated" ON public.contract_lobby_tokens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.contract_lobby_tokens IS 'Tek QR sözleşme onayı için token; oda bağlı değil. public-contract Edge Function bu tokenı kabul eder, room_id=null kaydeder.';

-- Admin panelden yeni lobby token üretir (1 yıl geçerli)
CREATE OR REPLACE FUNCTION public.generate_contract_lobby_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_expires TIMESTAMPTZ := now() + interval '1 year';
BEGIN
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.contract_lobby_tokens (token, expires_at)
  VALUES (v_token, v_expires);
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_contract_lobby_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_contract_lobby_token() TO authenticated;

COMMENT ON FUNCTION public.generate_contract_lobby_token() IS 'Tek QR sözleşme linki için token üretir; admin panelde "URL yazılsın" / QR basımında kullanılır.';
