-- Bölge rehberi: Trabzon / Uzungöl vb. admin tarafından resim + metin; misafir ve personel okur.

BEGIN;

CREATE TABLE IF NOT EXISTS public.local_area_guide_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text,
  image_urls text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_area_guide_org_published
  ON public.local_area_guide_entries (organization_id, is_published, sort_order DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.local_area_guide_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_local_area_guide_updated_at ON public.local_area_guide_entries;
CREATE TRIGGER trg_local_area_guide_updated_at
  BEFORE UPDATE ON public.local_area_guide_entries
  FOR EACH ROW EXECUTE FUNCTION public.local_area_guide_set_updated_at();

ALTER TABLE public.local_area_guide_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "local_area_guide_select_published" ON public.local_area_guide_entries;
CREATE POLICY "local_area_guide_select_published"
  ON public.local_area_guide_entries FOR SELECT TO authenticated
  USING (
    is_published = true
    AND (
      organization_id = public.current_guest_organization_id()
      OR EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.auth_id = auth.uid()
          AND s.is_active = true
          AND s.deleted_at IS NULL
          AND s.organization_id = local_area_guide_entries.organization_id
      )
    )
  );

DROP POLICY IF EXISTS "local_area_guide_select_admin_all" ON public.local_area_guide_entries;
CREATE POLICY "local_area_guide_select_admin_all"
  ON public.local_area_guide_entries FOR SELECT TO authenticated
  USING (
    public.current_user_is_staff_admin()
    AND organization_id = public.current_staff_organization_id()
  );

DROP POLICY IF EXISTS "local_area_guide_insert_admin" ON public.local_area_guide_entries;
CREATE POLICY "local_area_guide_insert_admin"
  ON public.local_area_guide_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_staff_admin()
    AND organization_id = public.current_staff_organization_id()
  );

DROP POLICY IF EXISTS "local_area_guide_update_admin" ON public.local_area_guide_entries;
CREATE POLICY "local_area_guide_update_admin"
  ON public.local_area_guide_entries FOR UPDATE TO authenticated
  USING (
    public.current_user_is_staff_admin()
    AND organization_id = public.current_staff_organization_id()
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
  );

DROP POLICY IF EXISTS "local_area_guide_delete_admin" ON public.local_area_guide_entries;
CREATE POLICY "local_area_guide_delete_admin"
  ON public.local_area_guide_entries FOR DELETE TO authenticated
  USING (
    public.current_user_is_staff_admin()
    AND organization_id = public.current_staff_organization_id()
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('local-area-guide', 'local-area-guide', true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.storage_local_area_guide_org_from_path(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(split_part(p_name, '/', 2), '')::uuid;
$$;

DROP POLICY IF EXISTS "local_area_guide_storage_read" ON storage.objects;
CREATE POLICY "local_area_guide_storage_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'local-area-guide');

DROP POLICY IF EXISTS "local_area_guide_storage_insert" ON storage.objects;
CREATE POLICY "local_area_guide_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'local-area-guide'
    AND public.storage_local_area_guide_org_from_path(name) = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "local_area_guide_storage_update" ON storage.objects;
CREATE POLICY "local_area_guide_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'local-area-guide'
    AND public.storage_local_area_guide_org_from_path(name) = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "local_area_guide_storage_delete" ON storage.objects;
CREATE POLICY "local_area_guide_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'local-area-guide'
    AND public.storage_local_area_guide_org_from_path(name) = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'local_area_guide_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.local_area_guide_entries;
  END IF;
END $$;

COMMIT;
