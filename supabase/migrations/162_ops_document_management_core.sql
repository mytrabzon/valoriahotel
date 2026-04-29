-- OPS schema: Document Management Module (core)
-- Scope: hotel-scoped document registry + versioning + approvals + logs + notifications
-- NOTE: Backend uses service-role; enforce auth/permission checks in API layer.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;

-- ========== PERMISSIONS (catalog seed) ==========
INSERT INTO ops.app_permissions (code, name, description)
VALUES
  ('document.view', 'Document view', 'View documents you have access to'),
  ('document.upload', 'Document upload', 'Create documents and upload versions'),
  ('document.edit', 'Document edit', 'Edit document metadata'),
  ('document.delete', 'Document delete', 'Delete documents (soft/archive by default)'),
  ('document.download', 'Document download', 'Download document files'),
  ('document.approve', 'Document approve', 'Approve/reject approval requests'),
  ('document.archive', 'Document archive', 'Archive documents'),
  ('document.restore', 'Document restore', 'Restore archived documents'),
  ('document.view_logs', 'Document logs view', 'View document audit logs'),
  ('document.manage_categories', 'Document categories manage', 'Create/update document categories')
ON CONFLICT (code) DO NOTHING;

-- ========== ENUM-LIKE CHECKS ==========
-- We keep these as text + CHECK for easier migrations (no enum churn).

-- ========== TABLES ==========

CREATE TABLE IF NOT EXISTS ops.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES ops.document_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  requires_approval boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES ops.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, parent_id, name)
);
CREATE INDEX IF NOT EXISTS ops_doc_categories_hotel_idx ON ops.document_categories(hotel_id);
CREATE INDEX IF NOT EXISTS ops_doc_categories_parent_idx ON ops.document_categories(parent_id);

CREATE TABLE IF NOT EXISTS ops.document_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, slug)
);
CREATE INDEX IF NOT EXISTS ops_doc_tags_hotel_idx ON ops.document_tags(hotel_id);

CREATE TABLE IF NOT EXISTS ops.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  title text NOT NULL,
  category_id uuid NOT NULL REFERENCES ops.document_categories(id) ON DELETE RESTRICT,
  department_code text, -- app-level department codes; can be NULL
  related_user_id uuid REFERENCES ops.app_users(id) ON DELETE SET NULL,
  related_company_name text,
  description text,
  visibility text NOT NULL DEFAULT 'department' CHECK (visibility IN ('public','department','authorized','admin_only','related_user_only')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','active','rejected','expiring_soon','expired','archived')),
  document_date date NOT NULL,
  valid_from date,
  expiry_date date,
  current_version_id uuid,
  uploaded_by uuid REFERENCES ops.app_users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES ops.app_users(id) ON DELETE SET NULL,
  rejected_reason text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_documents_hotel_created_idx ON ops.documents(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_documents_hotel_status_idx ON ops.documents(hotel_id, status);
CREATE INDEX IF NOT EXISTS ops_documents_hotel_expiry_idx ON ops.documents(hotel_id, expiry_date);
CREATE INDEX IF NOT EXISTS ops_documents_category_idx ON ops.documents(category_id);
CREATE INDEX IF NOT EXISTS ops_documents_related_user_idx ON ops.documents(related_user_id);

CREATE TABLE IF NOT EXISTS ops.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES ops.documents(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_url text,
  file_size bigint,
  mime_type text,
  checksum text,
  uploaded_by uuid REFERENCES ops.app_users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, document_id, version_no)
);
CREATE INDEX IF NOT EXISTS ops_doc_versions_document_idx ON ops.document_versions(document_id, version_no DESC);
CREATE INDEX IF NOT EXISTS ops_doc_versions_hotel_idx ON ops.document_versions(hotel_id);

-- FK added after both tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ops_documents_current_version_fk'
  ) THEN
    ALTER TABLE ops.documents
      ADD CONSTRAINT ops_documents_current_version_fk
      FOREIGN KEY (current_version_id)
      REFERENCES ops.document_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ops.document_tag_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES ops.documents(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES ops.document_tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, document_id, tag_id)
);
CREATE INDEX IF NOT EXISTS ops_doc_tag_map_document_idx ON ops.document_tag_map(document_id);
CREATE INDEX IF NOT EXISTS ops_doc_tag_map_tag_idx ON ops.document_tag_map(tag_id);

-- Per-document overrides (fine-grained)
CREATE TABLE IF NOT EXISTS ops.document_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES ops.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES ops.app_users(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT false,
  can_download boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, document_id, user_id)
);
CREATE INDEX IF NOT EXISTS ops_doc_perms_document_idx ON ops.document_permissions(document_id);
CREATE INDEX IF NOT EXISTS ops_doc_perms_user_idx ON ops.document_permissions(user_id);

CREATE TABLE IF NOT EXISTS ops.document_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES ops.documents(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES ops.app_users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES ops.app_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(hotel_id, document_id, status) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS ops_doc_approvals_document_idx ON ops.document_approvals(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_doc_approvals_hotel_status_idx ON ops.document_approvals(hotel_id, status);

CREATE TABLE IF NOT EXISTS ops.document_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  document_id uuid REFERENCES ops.documents(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES ops.app_users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_doc_logs_hotel_created_idx ON ops.document_logs(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_doc_logs_document_idx ON ops.document_logs(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_doc_logs_actor_idx ON ops.document_logs(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ops.document_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  document_id uuid REFERENCES ops.documents(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES ops.app_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_doc_notifs_user_created_idx ON ops.document_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_doc_notifs_hotel_created_idx ON ops.document_notifications(hotel_id, created_at DESC);

-- ========== UPDATED_AT TRIGGERS ==========
DROP TRIGGER IF EXISTS trg_ops_document_categories_updated ON ops.document_categories;
CREATE TRIGGER trg_ops_document_categories_updated BEFORE UPDATE ON ops.document_categories
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

DROP TRIGGER IF EXISTS trg_ops_documents_updated ON ops.documents;
CREATE TRIGGER trg_ops_documents_updated BEFORE UPDATE ON ops.documents
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

DROP TRIGGER IF EXISTS trg_ops_document_permissions_updated ON ops.document_permissions;
CREATE TRIGGER trg_ops_document_permissions_updated BEFORE UPDATE ON ops.document_permissions
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

-- ========== RLS ENABLE ==========
ALTER TABLE ops.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_tag_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.document_notifications ENABLE ROW LEVEL SECURITY;

-- ========== RLS POLICIES (defense-in-depth) ==========
-- NOTE: API uses service-role and must enforce; these policies still protect direct client access via anon/auth keys.

-- categories
DROP POLICY IF EXISTS "ops_doc_categories_select" ON ops.document_categories;
CREATE POLICY "ops_doc_categories_select" ON ops.document_categories
  FOR SELECT TO authenticated
  USING (hotel_id = ops.current_hotel_id() AND ops.has_permission('document.view'));

DROP POLICY IF EXISTS "ops_doc_categories_manage" ON ops.document_categories;
CREATE POLICY "ops_doc_categories_manage" ON ops.document_categories
  FOR ALL TO authenticated
  USING (hotel_id = ops.current_hotel_id() AND ops.has_permission('document.manage_categories'))
  WITH CHECK (hotel_id = ops.current_hotel_id() AND ops.has_permission('document.manage_categories'));

-- documents (basic hotel scoping; fine-grained handled in API)
DROP POLICY IF EXISTS "ops_documents_select" ON ops.documents;
CREATE POLICY "ops_documents_select" ON ops.documents
  FOR SELECT TO authenticated
  USING (hotel_id = ops.current_hotel_id() AND ops.has_permission('document.view'));

DROP POLICY IF EXISTS "ops_documents_write" ON ops.documents;
CREATE POLICY "ops_documents_write" ON ops.documents
  FOR ALL TO authenticated
  USING (hotel_id = ops.current_hotel_id() AND ops.has_permission('document.upload'))
  WITH CHECK (hotel_id = ops.current_hotel_id() AND ops.has_permission('document.upload'));

-- versions
DROP POLICY IF EXISTS "ops_document_versions_select" ON ops.document_versions;
CREATE POLICY "ops_document_versions_select" ON ops.document_versions
  FOR SELECT TO authenticated
  USING (hotel_id = ops.current_hotel_id() AND ops.has_permission('document.view'));

DROP POLICY IF EXISTS "ops_document_versions_insert" ON ops.document_versions;
CREATE POLICY "ops_document_versions_insert" ON ops.document_versions
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = ops.current_hotel_id() AND ops.has_permission('document.upload'));

-- logs
DROP POLICY IF EXISTS "ops_document_logs_select" ON ops.document_logs;
CREATE POLICY "ops_document_logs_select" ON ops.document_logs
  FOR SELECT TO authenticated
  USING (hotel_id = ops.current_hotel_id() AND ops.has_permission('document.view_logs'));

DROP POLICY IF EXISTS "ops_document_logs_insert" ON ops.document_logs;
CREATE POLICY "ops_document_logs_insert" ON ops.document_logs
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = ops.current_hotel_id());

-- notifications (self only)
DROP POLICY IF EXISTS "ops_document_notifs_select_own" ON ops.document_notifications;
CREATE POLICY "ops_document_notifs_select_own" ON ops.document_notifications
  FOR SELECT TO authenticated
  USING (hotel_id = ops.current_hotel_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "ops_document_notifs_update_own" ON ops.document_notifications;
CREATE POLICY "ops_document_notifs_update_own" ON ops.document_notifications
  FOR UPDATE TO authenticated
  USING (hotel_id = ops.current_hotel_id() AND user_id = auth.uid())
  WITH CHECK (hotel_id = ops.current_hotel_id() AND user_id = auth.uid());

COMMIT;

