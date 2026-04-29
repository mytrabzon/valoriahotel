-- Transfer & Tour: services, requests, storage, guest organization scoping

BEGIN;

-- Misafir → işletme (varsayılan Valoria; çoklu otel genişlemesi için)
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

UPDATE public.guests g
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'valoria' LIMIT 1)
WHERE g.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_guests_organization_id ON public.guests(organization_id);

-- ========== transfer_services ==========
CREATE TABLE IF NOT EXISTS public.transfer_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  service_type text NOT NULL DEFAULT 'transfer' CHECK (
    service_type IN ('transfer', 'vehicle_rental', 'tour', 'vip', 'custom_route')
  ),
  title jsonb NOT NULL DEFAULT '{}',
  description jsonb NOT NULL DEFAULT '{}',
  brand text,
  model text,
  year int,
  vehicle_size text NOT NULL DEFAULT 'medium' CHECK (vehicle_size IN ('small', 'medium', 'large', 'vip')),
  capacity int NOT NULL DEFAULT 4,
  luggage_capacity int NOT NULL DEFAULT 2,
  images text[] NOT NULL DEFAULT '{}',
  cover_image text,
  routes jsonb NOT NULL DEFAULT '[]',
  pricing_type text NOT NULL DEFAULT 'fixed' CHECK (pricing_type IN ('fixed', 'per_person', 'quote')),
  price numeric,
  currency text NOT NULL DEFAULT 'TRY',
  features text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  availability_status text NOT NULL DEFAULT 'available' CHECK (
    availability_status IN ('available', 'limited', 'on_request')
  ),
  created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_services_org_active ON public.transfer_services (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_transfer_services_type ON public.transfer_services (service_type);

-- ========== transfer_service_requests ==========
CREATE TABLE IF NOT EXISTS public.transfer_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.transfer_services(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  guest_name text,
  room_number text,
  request_date date NOT NULL,
  request_time text NOT NULL,
  passenger_count int NOT NULL DEFAULT 1,
  pickup_location text NOT NULL,
  dropoff_location text NOT NULL,
  phone text,
  note text,
  child_seat_requested boolean NOT NULL DEFAULT false,
  luggage_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'price_offer', 'completed', 'cancelled')
  ),
  price_offer numeric,
  offer_currency text,
  staff_note text,
  handled_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_req_org_status ON public.transfer_service_requests (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_req_guest ON public.transfer_service_requests (guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_req_service ON public.transfer_service_requests (service_id);

CREATE OR REPLACE FUNCTION public.transfer_tour_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_services_updated_at ON public.transfer_services;
CREATE TRIGGER trg_transfer_services_updated_at
  BEFORE UPDATE ON public.transfer_services
  FOR EACH ROW EXECUTE FUNCTION public.transfer_tour_set_updated_at();

DROP TRIGGER IF EXISTS trg_transfer_service_requests_updated_at ON public.transfer_service_requests;
CREATE TRIGGER trg_transfer_service_requests_updated_at
  BEFORE UPDATE ON public.transfer_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.transfer_tour_set_updated_at();

-- Misafir oturumundaki organization (NULL ise Valoria)
CREATE OR REPLACE FUNCTION public.current_guest_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT g.organization_id FROM public.guests g
     WHERE g.auth_user_id = auth.uid() AND g.deleted_at IS NULL
     LIMIT 1),
    (SELECT id FROM public.organizations WHERE slug = 'valoria' LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_has_transfer_tour_service_permission()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT
       s.role = 'admin'
       OR (s.app_permissions->>'transfer_tour_services') IN ('true', 't', '1', 'True', 'TRUE')
     FROM public.staff s
     WHERE s.auth_id = auth.uid() AND s.is_active = true AND s.deleted_at IS NULL
     LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_has_transfer_tour_request_permission()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT
       s.role = 'admin'
       OR (s.app_permissions->>'transfer_tour_requests') IN ('true', 't', '1', 'True', 'TRUE')
     FROM public.staff s
     WHERE s.auth_id = auth.uid() AND s.is_active = true AND s.deleted_at IS NULL
     LIMIT 1),
    false
  );
$$;

-- RLS
ALTER TABLE public.transfer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfer_services_select_guest" ON public.transfer_services;
CREATE POLICY "transfer_services_select_guest"
  ON public.transfer_services FOR SELECT TO authenticated
  USING (
    organization_id = public.current_guest_organization_id()
    AND is_active = true
  );

DROP POLICY IF EXISTS "transfer_services_select_staff" ON public.transfer_services;
CREATE POLICY "transfer_services_select_staff"
  ON public.transfer_services FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.organization_id = transfer_services.organization_id
    )
  );

DROP POLICY IF EXISTS "transfer_services_insert_staff" ON public.transfer_services;
CREATE POLICY "transfer_services_insert_staff"
  ON public.transfer_services FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_transfer_tour_service_permission())
  );

DROP POLICY IF EXISTS "transfer_services_update_staff" ON public.transfer_services;
CREATE POLICY "transfer_services_update_staff"
  ON public.transfer_services FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_transfer_tour_service_permission())
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
  );

DROP POLICY IF EXISTS "transfer_services_delete_staff" ON public.transfer_services;
CREATE POLICY "transfer_services_delete_staff"
  ON public.transfer_services FOR DELETE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND (public.current_user_is_staff_admin() OR public.staff_has_transfer_tour_service_permission())
  );

-- Requests: guest own insert/select
DROP POLICY IF EXISTS "transfer_requests_select_own" ON public.transfer_service_requests;
CREATE POLICY "transfer_requests_select_own"
  ON public.transfer_service_requests FOR SELECT TO authenticated
  USING (
    guest_id IN (SELECT g.id FROM public.guests g WHERE g.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "transfer_requests_insert_own" ON public.transfer_service_requests;
CREATE POLICY "transfer_requests_insert_own"
  ON public.transfer_service_requests FOR INSERT TO authenticated
  WITH CHECK (
    guest_id IN (SELECT g.id FROM public.guests g WHERE g.auth_user_id = auth.uid())
    AND organization_id = public.current_guest_organization_id()
  );

DROP POLICY IF EXISTS "transfer_requests_select_staff" ON public.transfer_service_requests;
CREATE POLICY "transfer_requests_select_staff"
  ON public.transfer_service_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.organization_id = transfer_service_requests.organization_id
    )
  );

DROP POLICY IF EXISTS "transfer_requests_update_staff" ON public.transfer_service_requests;
CREATE POLICY "transfer_requests_update_staff"
  ON public.transfer_service_requests FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND (public.staff_has_transfer_tour_request_permission() OR public.current_user_is_staff_admin())
  )
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('transfer-tour', 'transfer-tour', true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.storage_transfer_tour_org_from_path(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(split_part(p_name, '/', 2), '')::uuid;
$$;

DROP POLICY IF EXISTS "transfer_tour_storage_read" ON storage.objects;
CREATE POLICY "transfer_tour_storage_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'transfer-tour');

DROP POLICY IF EXISTS "transfer_tour_storage_insert" ON storage.objects;
CREATE POLICY "transfer_tour_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'transfer-tour'
  AND public.storage_transfer_tour_org_from_path(name) = public.current_staff_organization_id()
  AND (public.current_user_is_staff_admin() OR public.staff_has_transfer_tour_service_permission())
);

DROP POLICY IF EXISTS "transfer_tour_storage_update" ON storage.objects;
CREATE POLICY "transfer_tour_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'transfer-tour'
  AND public.storage_transfer_tour_org_from_path(name) = public.current_staff_organization_id()
  AND (public.current_user_is_staff_admin() OR public.staff_has_transfer_tour_service_permission())
);

DROP POLICY IF EXISTS "transfer_tour_storage_delete" ON storage.objects;
CREATE POLICY "transfer_tour_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'transfer-tour'
  AND public.storage_transfer_tour_org_from_path(name) = public.current_staff_organization_id()
  AND (public.current_user_is_staff_admin() OR public.staff_has_transfer_tour_service_permission())
);

COMMIT;
