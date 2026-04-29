BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_internal_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  complainant_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  complained_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  note text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_action_note text,
  handled_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_internal_complaints_note_not_blank CHECK (length(trim(note)) > 0),
  CONSTRAINT staff_internal_complaints_no_self CHECK (complainant_staff_id <> complained_staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_internal_complaints_org_status
  ON public.staff_internal_complaints (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_internal_complaints_complained
  ON public.staff_internal_complaints (complained_staff_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.staff_internal_complaints_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_internal_complaints_updated_at ON public.staff_internal_complaints;
CREATE TRIGGER trg_staff_internal_complaints_updated_at
  BEFORE UPDATE ON public.staff_internal_complaints
  FOR EACH ROW EXECUTE FUNCTION public.staff_internal_complaints_set_updated_at();

ALTER TABLE public.staff_internal_complaints ENABLE ROW LEVEL SECURITY;

-- Yalnizca admin bu kayitlari gorebilir
DROP POLICY IF EXISTS "staff_internal_complaints_select_admin" ON public.staff_internal_complaints;
CREATE POLICY "staff_internal_complaints_select_admin"
  ON public.staff_internal_complaints FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

-- Personel sadece kendi adina sikayet insert edebilir, sonradan okuyamaz.
DROP POLICY IF EXISTS "staff_internal_complaints_insert_staff" ON public.staff_internal_complaints;
CREATE POLICY "staff_internal_complaints_insert_staff"
  ON public.staff_internal_complaints FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND complainant_staff_id = public.current_staff_id()
    AND EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.id = complained_staff_id
        AND s.organization_id = public.current_staff_organization_id()
        AND s.deleted_at IS NULL
    )
  );

-- Sadece admin durum/not guncelleyebilir
DROP POLICY IF EXISTS "staff_internal_complaints_update_admin" ON public.staff_internal_complaints;
CREATE POLICY "staff_internal_complaints_update_admin"
  ON public.staff_internal_complaints FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

COMMIT;
