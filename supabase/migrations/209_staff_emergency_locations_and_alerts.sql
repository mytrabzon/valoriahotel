-- Staff emergency module: admin-managed locations + staff-triggered emergency alerts.

CREATE TABLE IF NOT EXISTS public.emergency_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS emergency_locations_active_sort_idx
  ON public.emergency_locations (is_active, sort_order, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS emergency_locations_name_unique
  ON public.emergency_locations (lower(name));

CREATE OR REPLACE FUNCTION public.set_emergency_locations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emergency_locations_updated_at ON public.emergency_locations;
CREATE TRIGGER trg_emergency_locations_updated_at
BEFORE UPDATE ON public.emergency_locations
FOR EACH ROW
EXECUTE FUNCTION public.set_emergency_locations_updated_at();

ALTER TABLE public.emergency_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_locations_select_active_staff ON public.emergency_locations;
CREATE POLICY emergency_locations_select_active_staff
ON public.emergency_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.auth_id = auth.uid()
      AND s.is_active = true
      AND s.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS emergency_locations_admin_insert ON public.emergency_locations;
CREATE POLICY emergency_locations_admin_insert
ON public.emergency_locations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.auth_id = auth.uid()
      AND s.role = 'admin'
      AND s.is_active = true
      AND s.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS emergency_locations_admin_update ON public.emergency_locations;
CREATE POLICY emergency_locations_admin_update
ON public.emergency_locations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.auth_id = auth.uid()
      AND s.role = 'admin'
      AND s.is_active = true
      AND s.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.auth_id = auth.uid()
      AND s.role = 'admin'
      AND s.is_active = true
      AND s.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS emergency_locations_admin_delete ON public.emergency_locations;
CREATE POLICY emergency_locations_admin_delete
ON public.emergency_locations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.auth_id = auth.uid()
      AND s.role = 'admin'
      AND s.is_active = true
      AND s.deleted_at IS NULL
  )
);

INSERT INTO public.emergency_locations (name, sort_order, is_active)
VALUES
  ('Reception', 10, true),
  ('Otopark', 20, true),
  ('Otel On Giris Kapisi', 30, true),
  ('Restorant', 40, true),
  ('Kazan Dairesi', 50, true),
  ('Camasirhane', 60, true)
ON CONFLICT DO NOTHING;
