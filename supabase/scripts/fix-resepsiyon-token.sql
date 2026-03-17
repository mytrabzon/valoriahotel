-- Resepsiyon QR linkinin çalışması için: tablo + token tek seferde.
-- Supabase Dashboard → SQL Editor → New query → yapıştır → Run

-- 1) Tablo yoksa oluştur
CREATE TABLE IF NOT EXISTS public.contract_lobby_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_lobby_tokens_token ON public.contract_lobby_tokens(token);
CREATE INDEX IF NOT EXISTS idx_contract_lobby_tokens_expires ON public.contract_lobby_tokens(expires_at);

ALTER TABLE public.contract_lobby_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contract_lobby_tokens_authenticated" ON public.contract_lobby_tokens;
CREATE POLICY "contract_lobby_tokens_authenticated" ON public.contract_lobby_tokens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) Resepsiyon token'ını ekle (varsa süresini 2 yıl uzat)
INSERT INTO public.contract_lobby_tokens (token, expires_at)
VALUES ('valoria-resepsiyon-qr', now() + interval '2 years')
ON CONFLICT (token) DO UPDATE SET expires_at = now() + interval '2 years';
