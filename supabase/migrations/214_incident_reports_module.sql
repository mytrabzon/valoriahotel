-- Otel Tutanak Sistemi (Incident Reports)
-- Admin odakli onay akisi + personel taslak/olusturma akisi

BEGIN;

CREATE TABLE IF NOT EXISTS public.incident_report_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_report_types_code_not_blank CHECK (length(trim(code)) > 0),
  CONSTRAINT incident_report_types_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT incident_report_types_org_code_uniq UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_incident_report_types_org_active
  ON public.incident_report_types (organization_id, is_active, sort_order DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  report_no text NOT NULL,
  report_type_id uuid NOT NULL REFERENCES public.incident_report_types(id) ON DELETE RESTRICT,
  department text,
  hotel_name text NOT NULL DEFAULT 'Valoria Hotel',
  occurred_at timestamptz NOT NULL,
  location_label text NOT NULL,
  room_number text,
  related_guest_name text,
  related_staff_name text,
  related_external_person_name text,
  description text NOT NULL,
  action_taken text,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'pending_admin_approval',
      'revision_requested',
      'approved',
      'pdf_generated',
      'archived',
      'cancelled'
    )
  ),
  created_by_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  approved_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at timestamptz,
  revision_requested_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  revision_requested_at timestamptz,
  revision_note text,
  cancelled_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  archived_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  archived_at timestamptz,
  pdf_file_path text,
  pdf_generated_at timestamptz,
  pdf_generated_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  printed_at timestamptz,
  printed_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  parent_report_id uuid REFERENCES public.incident_reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_reports_report_no_not_blank CHECK (length(trim(report_no)) > 0),
  CONSTRAINT incident_reports_location_not_blank CHECK (length(trim(location_label)) > 0),
  CONSTRAINT incident_reports_description_not_blank CHECK (length(trim(description)) > 0),
  CONSTRAINT incident_reports_revision_note_required CHECK (
    status <> 'revision_requested' OR (revision_note IS NOT NULL AND length(trim(revision_note)) > 0)
  ),
  CONSTRAINT incident_reports_approval_fields_consistent CHECK (
    (status IN ('approved', 'pdf_generated', 'archived') AND approved_at IS NOT NULL)
    OR (status NOT IN ('approved', 'pdf_generated', 'archived'))
  ),
  CONSTRAINT incident_reports_pdf_fields_consistent CHECK (
    (status = 'pdf_generated' AND pdf_generated_at IS NOT NULL AND pdf_file_path IS NOT NULL)
    OR status <> 'pdf_generated'
  ),
  CONSTRAINT incident_reports_cancelled_fields_consistent CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR status <> 'cancelled'
  ),
  CONSTRAINT incident_reports_archived_fields_consistent CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR status <> 'archived'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_incident_reports_org_report_no
  ON public.incident_reports (organization_id, report_no);
CREATE INDEX IF NOT EXISTS idx_incident_reports_org_status_created
  ON public.incident_reports (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_reports_org_occurred
  ON public.incident_reports (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_reports_org_room
  ON public.incident_reports (organization_id, room_number);
CREATE INDEX IF NOT EXISTS idx_incident_reports_created_by
  ON public.incident_reports (created_by_staff_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.incident_report_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  thumbnail_path text,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_by_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_report_media_report
  ON public.incident_report_media (report_id, sort_order ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_incident_report_media_org_report
  ON public.incident_report_media (organization_id, report_id);

CREATE TABLE IF NOT EXISTS public.incident_report_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  person_role text NOT NULL CHECK (
    person_role IN ('guest', 'staff', 'external', 'witness')
  ),
  full_name text NOT NULL,
  title text,
  contact_info text,
  signature_status text NOT NULL DEFAULT 'pending' CHECK (
    signature_status IN ('pending', 'signed', 'refused')
  ),
  refusal_note text,
  created_by_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_report_people_name_not_blank CHECK (length(trim(full_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_incident_report_people_report
  ON public.incident_report_people (report_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.incident_report_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  signer_role text NOT NULL CHECK (
    signer_role IN ('creator', 'witness', 'guest', 'manager')
  ),
  signer_name text,
  signer_title text,
  signature_file_path text,
  refused boolean NOT NULL DEFAULT false,
  refusal_note text,
  created_by_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_report_signatures_refusal_consistent CHECK (
    (refused = true AND (refusal_note IS NOT NULL AND length(trim(refusal_note)) > 0))
    OR refused = false
  )
);

CREATE INDEX IF NOT EXISTS idx_incident_report_signatures_report
  ON public.incident_report_signatures (report_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.incident_report_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  note text NOT NULL,
  include_in_pdf boolean NOT NULL DEFAULT false,
  created_by_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_report_internal_notes_not_blank CHECK (length(trim(note)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_incident_report_internal_notes_report
  ON public.incident_report_internal_notes (report_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.incident_report_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}',
  actor_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_report_audit_log_event_type_not_blank CHECK (length(trim(event_type)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_incident_report_audit_log_report
  ON public.incident_report_audit_log (report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_report_audit_log_org_created
  ON public.incident_report_audit_log (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.staff_has_incident_reports_permission()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        s.role = 'admin'
        OR (s.app_permissions->>'incident_reports') IN ('true', 't', '1', 'True', 'TRUE')
        OR (s.app_permissions->>'tutanaklar') IN ('true', 't', '1', 'True', 'TRUE')
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
      LIMIT 1
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.staff s
  WHERE s.auth_id = auth.uid()
    AND s.is_active = true
    AND s.deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.incident_reports_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_reports_updated_at ON public.incident_reports;
CREATE TRIGGER trg_incident_reports_updated_at
  BEFORE UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.incident_reports_set_updated_at();

CREATE OR REPLACE FUNCTION public.incident_reports_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Onay/PDF/Arsiv sonrasinda icerik alanlari degistirilemez.
  IF OLD.status IN ('approved', 'pdf_generated', 'archived')
     AND (
       NEW.report_type_id IS DISTINCT FROM OLD.report_type_id OR
       NEW.department IS DISTINCT FROM OLD.department OR
       NEW.hotel_name IS DISTINCT FROM OLD.hotel_name OR
       NEW.occurred_at IS DISTINCT FROM OLD.occurred_at OR
       NEW.location_label IS DISTINCT FROM OLD.location_label OR
       NEW.room_number IS DISTINCT FROM OLD.room_number OR
       NEW.related_guest_name IS DISTINCT FROM OLD.related_guest_name OR
       NEW.related_staff_name IS DISTINCT FROM OLD.related_staff_name OR
       NEW.related_external_person_name IS DISTINCT FROM OLD.related_external_person_name OR
       NEW.description IS DISTINCT FROM OLD.description OR
       NEW.action_taken IS DISTINCT FROM OLD.action_taken OR
       NEW.created_by_staff_id IS DISTINCT FROM OLD.created_by_staff_id
     ) THEN
    RAISE EXCEPTION 'Approved/PDF/Archived reports are immutable';
  END IF;

  -- Durum geri sarma engeli
  IF OLD.status IN ('approved', 'pdf_generated', 'archived') AND NEW.status IN ('draft', 'pending_admin_approval', 'revision_requested') THEN
    RAISE EXCEPTION 'Status rollback is not allowed after approval';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_reports_immutability ON public.incident_reports;
CREATE TRIGGER trg_incident_reports_immutability
  BEFORE UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.incident_reports_enforce_immutability();

CREATE OR REPLACE FUNCTION public.incident_reports_audit_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor_staff_id uuid;
BEGIN
  v_actor_staff_id := public.current_staff_id();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.incident_report_audit_log (
      organization_id, report_id, event_type, event_payload, actor_staff_id
    )
    VALUES (
      NEW.organization_id,
      NEW.id,
      'created',
      jsonb_build_object('status', NEW.status, 'report_no', NEW.report_no),
      v_actor_staff_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.incident_report_audit_log (
      organization_id, report_id, event_type, event_payload, actor_staff_id
    )
    VALUES (
      NEW.organization_id,
      NEW.id,
      CASE
        WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_changed'
        ELSE 'updated'
      END,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'changed_at', now()
      ),
      v_actor_staff_id
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_reports_audit_ins_upd ON public.incident_reports;
CREATE TRIGGER trg_incident_reports_audit_ins_upd
  AFTER INSERT OR UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.incident_reports_audit_trg();

ALTER TABLE public.incident_report_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_report_audit_log ENABLE ROW LEVEL SECURITY;

-- Types
DROP POLICY IF EXISTS "incident_report_types_select_staff" ON public.incident_report_types;
CREATE POLICY "incident_report_types_select_staff"
  ON public.incident_report_types FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_report_types_manage_admin" ON public.incident_report_types;
CREATE POLICY "incident_report_types_manage_admin"
  ON public.incident_report_types FOR ALL TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

-- Reports
DROP POLICY IF EXISTS "incident_reports_select_staff" ON public.incident_reports;
CREATE POLICY "incident_reports_select_staff"
  ON public.incident_reports FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_reports_insert_staff" ON public.incident_reports;
CREATE POLICY "incident_reports_insert_staff"
  ON public.incident_reports FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
    AND created_by_staff_id = public.current_staff_id()
  );

DROP POLICY IF EXISTS "incident_reports_update_staff" ON public.incident_reports;
CREATE POLICY "incident_reports_update_staff"
  ON public.incident_reports FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_reports_delete_admin_only" ON public.incident_reports;
CREATE POLICY "incident_reports_delete_admin_only"
  ON public.incident_reports FOR DELETE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

-- Child tables helper policies
DROP POLICY IF EXISTS "incident_report_media_select_staff" ON public.incident_report_media;
CREATE POLICY "incident_report_media_select_staff"
  ON public.incident_report_media FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_report_media_modify_staff" ON public.incident_report_media;
CREATE POLICY "incident_report_media_modify_staff"
  ON public.incident_report_media FOR ALL TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
    AND EXISTS (
      SELECT 1
      FROM public.incident_reports r
      WHERE r.id = incident_report_media.report_id
        AND r.organization_id = public.current_staff_organization_id()
        AND r.status IN ('draft', 'pending_admin_approval', 'revision_requested')
    )
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_report_people_select_staff" ON public.incident_report_people;
CREATE POLICY "incident_report_people_select_staff"
  ON public.incident_report_people FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_report_people_modify_staff" ON public.incident_report_people;
CREATE POLICY "incident_report_people_modify_staff"
  ON public.incident_report_people FOR ALL TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
    AND EXISTS (
      SELECT 1
      FROM public.incident_reports r
      WHERE r.id = incident_report_people.report_id
        AND r.organization_id = public.current_staff_organization_id()
        AND r.status IN ('draft', 'pending_admin_approval', 'revision_requested')
    )
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_report_signatures_select_staff" ON public.incident_report_signatures;
CREATE POLICY "incident_report_signatures_select_staff"
  ON public.incident_report_signatures FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_report_signatures_modify_staff" ON public.incident_report_signatures;
CREATE POLICY "incident_report_signatures_modify_staff"
  ON public.incident_report_signatures FOR ALL TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
    AND EXISTS (
      SELECT 1
      FROM public.incident_reports r
      WHERE r.id = incident_report_signatures.report_id
        AND r.organization_id = public.current_staff_organization_id()
        AND r.status IN ('draft', 'pending_admin_approval', 'revision_requested')
    )
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_report_internal_notes_select_staff" ON public.incident_report_internal_notes;
CREATE POLICY "incident_report_internal_notes_select_staff"
  ON public.incident_report_internal_notes FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

DROP POLICY IF EXISTS "incident_report_internal_notes_modify_admin" ON public.incident_report_internal_notes;
CREATE POLICY "incident_report_internal_notes_modify_admin"
  ON public.incident_report_internal_notes FOR ALL TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "incident_report_audit_log_select_staff" ON public.incident_report_audit_log;
CREATE POLICY "incident_report_audit_log_select_staff"
  ON public.incident_report_audit_log FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
  );

-- Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-reports', 'incident-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.storage_incident_reports_org_from_path(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(split_part(p_name, '/', 2), '')::uuid;
$$;

DROP POLICY IF EXISTS "incident_reports_storage_read" ON storage.objects;
CREATE POLICY "incident_reports_storage_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'incident-reports'
  AND public.storage_incident_reports_org_from_path(name) = public.current_staff_organization_id()
  AND public.staff_has_incident_reports_permission()
);

DROP POLICY IF EXISTS "incident_reports_storage_insert" ON storage.objects;
CREATE POLICY "incident_reports_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'incident-reports'
  AND public.storage_incident_reports_org_from_path(name) = public.current_staff_organization_id()
  AND public.staff_has_incident_reports_permission()
);

DROP POLICY IF EXISTS "incident_reports_storage_update" ON storage.objects;
CREATE POLICY "incident_reports_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'incident-reports'
  AND public.storage_incident_reports_org_from_path(name) = public.current_staff_organization_id()
  AND public.staff_has_incident_reports_permission()
);

DROP POLICY IF EXISTS "incident_reports_storage_delete" ON storage.objects;
CREATE POLICY "incident_reports_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'incident-reports'
  AND public.storage_incident_reports_org_from_path(name) = public.current_staff_organization_id()
  AND (
    public.current_user_is_staff_admin()
    OR public.staff_has_incident_reports_permission()
  )
);

-- Varsayilan tutanak turleri (Valoria)
INSERT INTO public.incident_report_types (organization_id, code, name, is_system, is_active, sort_order)
SELECT o.id, seed.code, seed.name, true, true, seed.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('room_damage', 'Oda hasar tutanagi', 100),
    ('guest_complaint', 'Misafir sikayet tutanagi', 90),
    ('staff_incident', 'Personel olay tutanagi', 80),
    ('lost_item', 'Kayip esya tutanagi', 70),
    ('found_item', 'Buluntu esya tutanagi', 60),
    ('payment_issue', 'Odeme / tahsilat problemi tutanagi', 50),
    ('noise_disturbance', 'Gurultu / rahatsizlik tutanagi', 40),
    ('security_police', 'Guvenlik / kavga / polislik olay tutanagi', 30),
    ('fixed_asset_damage', 'Demirbas hasar tutanagi', 20),
    ('general_incident', 'Genel olay tutanagi', 10)
) AS seed(code, name, sort_order)
WHERE o.slug = 'valoria'
ON CONFLICT (organization_id, code) DO NOTHING;

COMMIT;
