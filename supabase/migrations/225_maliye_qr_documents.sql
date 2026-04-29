BEGIN;

CREATE TABLE IF NOT EXISTS public.maliye_document_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_maliye_sections_org_order
  ON public.maliye_document_sections (organization_id, display_order, created_at);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_maliye_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maliye_section_id uuid REFERENCES public.maliye_document_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS maliye_display_order int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_documents_maliye_visible
  ON public.documents (organization_id, is_maliye_visible, maliye_display_order, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.maliye_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  pin_salt text NOT NULL,
  pin_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maliye_tokens_org_active
  ON public.maliye_access_tokens (organization_id, is_active, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.maliye_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.maliye_access_tokens(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maliye_logs_org_created
  ON public.maliye_audit_logs (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.maliye_hash_pin(pin_input text, salt_input text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT md5(COALESCE(pin_input, '') || ':' || COALESCE(salt_input, ''));
$$;

CREATE OR REPLACE FUNCTION public.create_maliye_access_token(
  pin_input text,
  expires_in interval DEFAULT interval '24 hours'
)
RETURNS public.maliye_access_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_org_id uuid;
  v_salt text;
  v_token text;
  v_row public.maliye_access_tokens;
BEGIN
  IF pin_input IS NULL OR char_length(trim(pin_input)) < 4 THEN
    RAISE EXCEPTION 'PIN en az 4 karakter olmalı';
  END IF;

  IF NOT public.current_user_is_staff_admin() THEN
    RAISE EXCEPTION 'Sadece admin token üretebilir';
  END IF;

  SELECT public.current_staff_id(), public.current_staff_organization_id()
    INTO v_staff_id, v_org_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organizasyon bulunamadı';
  END IF;

  UPDATE public.maliye_access_tokens
     SET is_active = false
   WHERE organization_id = v_org_id
     AND is_active = true;

  v_salt := md5(random()::text || clock_timestamp()::text || pin_input);
  v_token := upper(md5(random()::text || clock_timestamp()::text || v_org_id::text || v_staff_id::text));

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
    v_token,
    v_salt,
    public.maliye_hash_pin(pin_input, v_salt),
    now() + expires_in,
    true,
    v_staff_id
  )
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
    'token.created',
    true,
    jsonb_build_object('expires_at', v_row.expires_at)
  );

  RETURN v_row;
END;
$$;

DROP TRIGGER IF EXISTS trg_maliye_sections_updated ON public.maliye_document_sections;
CREATE TRIGGER trg_maliye_sections_updated
BEFORE UPDATE ON public.maliye_document_sections
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.maliye_document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maliye_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maliye_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maliye_sections_select" ON public.maliye_document_sections;
CREATE POLICY "maliye_sections_select" ON public.maliye_document_sections
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    OR public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "maliye_sections_admin_write" ON public.maliye_document_sections;
CREATE POLICY "maliye_sections_admin_write" ON public.maliye_document_sections
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "maliye_tokens_select_admin" ON public.maliye_access_tokens;
CREATE POLICY "maliye_tokens_select_admin" ON public.maliye_access_tokens
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "maliye_tokens_admin_write" ON public.maliye_access_tokens;
CREATE POLICY "maliye_tokens_admin_write" ON public.maliye_access_tokens
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "maliye_logs_select_admin" ON public.maliye_audit_logs;
CREATE POLICY "maliye_logs_select_admin" ON public.maliye_audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "maliye_logs_insert_admin" ON public.maliye_audit_logs;
CREATE POLICY "maliye_logs_insert_admin" ON public.maliye_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

COMMIT;
