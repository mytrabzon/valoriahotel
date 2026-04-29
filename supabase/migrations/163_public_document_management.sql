-- Public schema: Document Management Module (app-native)
-- Rationale: Mobile app uses public.staff + staff.app_permissions; keep doc mgmt in public with organization scoping.

BEGIN;

-- ========== HELPERS ==========
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.staff s
  WHERE s.auth_id = auth.uid() AND s.is_active = true AND s.deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_staff_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.organization_id
  FROM public.staff s
  WHERE s.auth_id = auth.uid() AND s.is_active = true AND s.deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.staff_has_app_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (s.app_permissions->>p_key) = 'true'
     FROM public.staff s
     WHERE s.auth_id = auth.uid() AND s.is_active = true AND s.deleted_at IS NULL
     LIMIT 1),
    false
  );
$$;

-- ========== TABLES ==========
CREATE TABLE IF NOT EXISTS public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES public.document_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  requires_approval boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, parent_id, name)
);
CREATE INDEX IF NOT EXISTS idx_doc_categories_org ON public.document_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_categories_parent ON public.document_categories(parent_id);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  title text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.document_categories(id) ON DELETE RESTRICT,
  department text,
  related_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  related_company_name text,
  description text,
  visibility text NOT NULL DEFAULT 'department' CHECK (visibility IN ('public','department','authorized','admin_only','related_staff_only')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','active','rejected','expiring_soon','expired','archived')),
  document_date date NOT NULL,
  valid_from date,
  expiry_date date,
  current_version_id uuid,
  uploaded_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  rejected_reason text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_org_created ON public.documents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_org_status ON public.documents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_org_expiry ON public.documents(organization_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_related_staff ON public.documents(related_staff_id);

CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  checksum text,
  uploaded_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, document_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON public.document_versions(document_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_doc_versions_org ON public.document_versions(organization_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_current_version_fk') THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_current_version_fk
      FOREIGN KEY (current_version_id)
      REFERENCES public.document_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.document_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  requested_by_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  reviewed_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_doc_approvals_org_status ON public.document_approvals(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_doc_approvals_doc_created ON public.document_approvals(document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.document_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  actor_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_logs_org_created ON public.document_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_logs_doc_created ON public.document_logs(document_id, created_at DESC);

-- ========== UPDATED_AT ==========
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_doc_categories_updated ON public.document_categories;
CREATE TRIGGER trg_doc_categories_updated BEFORE UPDATE ON public.document_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_documents_updated ON public.documents;
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== RLS ==========
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_logs ENABLE ROW LEVEL SECURITY;

-- Read: staff in same org (or admin) can view basic module
DROP POLICY IF EXISTS "doc_categories_select" ON public.document_categories;
CREATE POLICY "doc_categories_select" ON public.document_categories
  FOR SELECT TO authenticated USING (
    organization_id = public.current_staff_organization_id()
    OR public.current_user_is_staff_admin()
  );

-- Category manage: admin only
DROP POLICY IF EXISTS "doc_categories_write_admin" ON public.document_categories;
CREATE POLICY "doc_categories_write_admin" ON public.document_categories
  FOR ALL TO authenticated
  USING (public.current_user_is_staff_admin())
  WITH CHECK (public.current_user_is_staff_admin());

-- Documents select: same org
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated USING (
    organization_id = public.current_staff_organization_id()
    OR public.current_user_is_staff_admin()
  );

-- Documents insert/update: admin or dokuman_yukle permission
DROP POLICY IF EXISTS "documents_write" ON public.documents;
CREATE POLICY "documents_write" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_app_permission('dokuman_yukle'))
  );

DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_app_permission('dokuman_yukle'))
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_app_permission('dokuman_yukle'))
  );

-- Delete: admin only (hard delete)
DROP POLICY IF EXISTS "documents_delete_admin" ON public.documents;
CREATE POLICY "documents_delete_admin" ON public.documents
  FOR DELETE TO authenticated USING (public.current_user_is_staff_admin());

-- Versions: view same org; insert admin or dokuman_yukle
DROP POLICY IF EXISTS "doc_versions_select" ON public.document_versions;
CREATE POLICY "doc_versions_select" ON public.document_versions
  FOR SELECT TO authenticated USING (
    organization_id = public.current_staff_organization_id()
    OR public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "doc_versions_insert" ON public.document_versions;
CREATE POLICY "doc_versions_insert" ON public.document_versions
  FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_app_permission('dokuman_yukle'))
  );

DROP POLICY IF EXISTS "doc_versions_delete_admin" ON public.document_versions;
CREATE POLICY "doc_versions_delete_admin" ON public.document_versions
  FOR DELETE TO authenticated USING (public.current_user_is_staff_admin());

-- Approvals: read same org; update only admin
DROP POLICY IF EXISTS "doc_approvals_select" ON public.document_approvals;
CREATE POLICY "doc_approvals_select" ON public.document_approvals
  FOR SELECT TO authenticated USING (
    organization_id = public.current_staff_organization_id()
    OR public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "doc_approvals_insert" ON public.document_approvals;
CREATE POLICY "doc_approvals_insert" ON public.document_approvals
  FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_app_permission('dokuman_yukle'))
  );

DROP POLICY IF EXISTS "doc_approvals_update_admin" ON public.document_approvals;
CREATE POLICY "doc_approvals_update_admin" ON public.document_approvals
  FOR UPDATE TO authenticated
  USING (public.current_user_is_staff_admin())
  WITH CHECK (public.current_user_is_staff_admin());

-- Logs: select same org admin-only; insert allowed in org (writer)
DROP POLICY IF EXISTS "doc_logs_select_admin" ON public.document_logs;
CREATE POLICY "doc_logs_select_admin" ON public.document_logs
  FOR SELECT TO authenticated USING (
    public.current_user_is_staff_admin()
    AND organization_id = public.current_staff_organization_id()
  );

DROP POLICY IF EXISTS "doc_logs_insert" ON public.document_logs;
CREATE POLICY "doc_logs_insert" ON public.document_logs
  FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_staff_organization_id()
  );

COMMIT;

