-- Yemek & Mekanlar: otelin önerdiği restoran, kafe, büfe rehberi

BEGIN;

CREATE TABLE IF NOT EXISTS public.dining_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name text NOT NULL,
  venue_type text NOT NULL DEFAULT 'restaurant' CHECK (venue_type IN ('restaurant', 'cafe', 'buffet')),
  description text,
  cuisine_tags text[] NOT NULL DEFAULT '{}',
  price_level int NOT NULL DEFAULT 2 CHECK (price_level BETWEEN 1 AND 3),
  images text[] NOT NULL DEFAULT '{}',
  cover_image text,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  opening_hours text,
  location_scope text NOT NULL DEFAULT 'off_premises' CHECK (location_scope IN ('on_premises', 'off_premises')),
  is_open_now boolean NOT NULL DEFAULT true,
  directions_text text,
  reservation_info text,
  menu_items jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dining_venues_org_active ON public.dining_venues (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_dining_venues_org_sort ON public.dining_venues (organization_id, sort_order DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.dining_venues_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dining_venues_updated_at ON public.dining_venues;
CREATE TRIGGER trg_dining_venues_updated_at
  BEFORE UPDATE ON public.dining_venues
  FOR EACH ROW EXECUTE FUNCTION public.dining_venues_set_updated_at();

CREATE OR REPLACE FUNCTION public.staff_has_dining_venues_permission()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT
       s.role = 'admin'
       OR (s.app_permissions->>'dining_venues') IN ('true', 't', '1', 'True', 'TRUE')
     FROM public.staff s
     WHERE s.auth_id = auth.uid() AND s.is_active = true AND s.deleted_at IS NULL
     LIMIT 1),
    false
  );
$$;

ALTER TABLE public.dining_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dining_venues_select_guest" ON public.dining_venues;
CREATE POLICY "dining_venues_select_guest"
  ON public.dining_venues FOR SELECT TO authenticated
  USING (
    organization_id = public.current_guest_organization_id()
    AND is_active = true
  );

DROP POLICY IF EXISTS "dining_venues_select_staff" ON public.dining_venues;
CREATE POLICY "dining_venues_select_staff"
  ON public.dining_venues FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.organization_id = dining_venues.organization_id
    )
  );

DROP POLICY IF EXISTS "dining_venues_insert_staff" ON public.dining_venues;
CREATE POLICY "dining_venues_insert_staff"
  ON public.dining_venues FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_dining_venues_permission())
  );

DROP POLICY IF EXISTS "dining_venues_update_staff" ON public.dining_venues;
CREATE POLICY "dining_venues_update_staff"
  ON public.dining_venues FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_dining_venues_permission())
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
  );

DROP POLICY IF EXISTS "dining_venues_delete_staff" ON public.dining_venues;
CREATE POLICY "dining_venues_delete_staff"
  ON public.dining_venues FOR DELETE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_dining_venues_permission())
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('dining-venues', 'dining-venues', true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.storage_dining_venues_org_from_path(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(split_part(p_name, '/', 2), '')::uuid;
$$;

DROP POLICY IF EXISTS "dining_venues_storage_read" ON storage.objects;
CREATE POLICY "dining_venues_storage_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dining-venues');

DROP POLICY IF EXISTS "dining_venues_storage_insert" ON storage.objects;
CREATE POLICY "dining_venues_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dining-venues'
  AND public.storage_dining_venues_org_from_path(name) = public.current_staff_organization_id()
  AND (public.current_user_is_staff_admin() OR public.staff_has_dining_venues_permission())
);

DROP POLICY IF EXISTS "dining_venues_storage_update" ON storage.objects;
CREATE POLICY "dining_venues_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'dining-venues'
  AND public.storage_dining_venues_org_from_path(name) = public.current_staff_organization_id()
  AND (public.current_user_is_staff_admin() OR public.staff_has_dining_venues_permission())
);

DROP POLICY IF EXISTS "dining_venues_storage_delete" ON storage.objects;
CREATE POLICY "dining_venues_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'dining-venues'
  AND public.storage_dining_venues_org_from_path(name) = public.current_staff_organization_id()
  AND (public.current_user_is_staff_admin() OR public.staff_has_dining_venues_permission())
);

COMMIT;
