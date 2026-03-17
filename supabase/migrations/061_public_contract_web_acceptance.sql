-- Public (no-app) contract acceptance + revisioned URL
-- Adds:
-- - contract_public_settings: single-row settings (public_revision)
-- - contract_acceptances: records web acceptances for audit
-- - RPC to bump/get revision

-- Tek satır: key = 'default' ile tanımlı
CREATE TABLE IF NOT EXISTS public.contract_public_settings (
  key TEXT PRIMARY KEY DEFAULT 'default' CHECK (key = 'default'),
  public_revision UUID NOT NULL DEFAULT gen_random_uuid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tek satırı oluştur
INSERT INTO public.contract_public_settings (key)
VALUES ('default')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.contract_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  contract_lang TEXT NOT NULL CHECK (contract_lang IN ('tr', 'en', 'ar', 'de', 'fr', 'ru', 'es')),
  contract_version INTEGER NOT NULL,
  contract_template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address INET,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'app', 'kiosk')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_acceptances_token ON public.contract_acceptances(token);
CREATE INDEX IF NOT EXISTS idx_contract_acceptances_room ON public.contract_acceptances(room_id);
CREATE INDEX IF NOT EXISTS idx_contract_acceptances_accepted_at ON public.contract_acceptances(accepted_at);

ALTER TABLE public.contract_public_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

-- Anyone can read current public revision (so QR can embed it; no sensitive data)
DROP POLICY IF EXISTS "contract_public_settings_read" ON public.contract_public_settings;
CREATE POLICY "contract_public_settings_read"
ON public.contract_public_settings FOR SELECT TO anon, authenticated
USING (true);

-- Only authenticated staff/admin should update settings directly (RPC below is SECURITY DEFINER)
DROP POLICY IF EXISTS "contract_public_settings_write" ON public.contract_public_settings;
CREATE POLICY "contract_public_settings_write"
ON public.contract_public_settings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Allow anonymous inserts for acceptance audit (Edge Function uses service role anyway)
DROP POLICY IF EXISTS "contract_acceptances_insert_anon" ON public.contract_acceptances;
CREATE POLICY "contract_acceptances_insert_anon"
ON public.contract_acceptances FOR INSERT TO anon
WITH CHECK (true);

-- Staff can read acceptances
DROP POLICY IF EXISTS "contract_acceptances_read_staff" ON public.contract_acceptances;
CREATE POLICY "contract_acceptances_read_staff"
ON public.contract_acceptances FOR SELECT TO authenticated
USING (true);

-- RPC: bump revision (call from admin app after saving contract)
CREATE OR REPLACE FUNCTION public.bump_contract_public_revision()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new UUID := gen_random_uuid();
BEGIN
  UPDATE public.contract_public_settings
  SET public_revision = v_new,
      updated_at = now()
  WHERE key = 'default';
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_contract_public_revision() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_contract_public_revision() TO authenticated;

-- RPC: get current revision (nice for QR generation)
CREATE OR REPLACE FUNCTION public.get_contract_public_revision()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT public_revision FROM public.contract_public_settings WHERE key = 'default' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_contract_public_revision() TO anon, authenticated;

