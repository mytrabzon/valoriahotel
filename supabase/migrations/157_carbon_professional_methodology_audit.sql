-- Karbon modülü: metodoloji alanları, denetim geçmişi, kanıt dosyaları, yoğunluk yardımcıları

BEGIN;

-- Aylık girdi tablosu: kaynak ve doğrulama metinleri
ALTER TABLE public.hotel_carbon_monthly_inputs
  ADD COLUMN IF NOT EXISTS methodology_version TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS methodology_summary TEXT,
  ADD COLUMN IF NOT EXISTS electricity_factor_source TEXT,
  ADD COLUMN IF NOT EXISTS water_factor_source TEXT,
  ADD COLUMN IF NOT EXISTS gas_factor_source TEXT,
  ADD COLUMN IF NOT EXISTS waste_factor_source TEXT,
  ADD COLUMN IF NOT EXISTS data_collection_notes TEXT,
  ADD COLUMN IF NOT EXISTS prepared_by_name TEXT,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

COMMENT ON COLUMN public.hotel_carbon_monthly_inputs.methodology_version IS 'İç metodoloji sürüm etiketi (raporlarda gösterilir)';
COMMENT ON COLUMN public.hotel_carbon_monthly_inputs.electricity_factor_source IS 'Emisyon katsayısı kaynağı (ör. TBMP, EPA, şebeke faktörü yılı)';

-- Denetim: her kayıt değişikliği anlık kopya
CREATE TABLE IF NOT EXISTS public.hotel_carbon_monthly_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_start DATE NOT NULL,
  snapshot JSONB NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_hotel_carbon_monthly_history_month
  ON public.hotel_carbon_monthly_history (month_start DESC, changed_at DESC);

ALTER TABLE public.hotel_carbon_monthly_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hotel_carbon_monthly_history_admin_select" ON public.hotel_carbon_monthly_history;
CREATE POLICY "hotel_carbon_monthly_history_admin_select"
ON public.hotel_carbon_monthly_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_id = auth.uid() AND s.role = 'admin'
  )
);

CREATE OR REPLACE FUNCTION public.log_hotel_carbon_monthly_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.hotel_carbon_monthly_history (month_start, snapshot, changed_by)
  VALUES (
    NEW.month_start,
    to_jsonb(NEW),
    COALESCE(NEW.updated_by, NEW.created_by)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hotel_carbon_monthly_inputs_history ON public.hotel_carbon_monthly_inputs;
CREATE TRIGGER hotel_carbon_monthly_inputs_history
AFTER INSERT OR UPDATE ON public.hotel_carbon_monthly_inputs
FOR EACH ROW
EXECUTE FUNCTION public.log_hotel_carbon_monthly_history();

-- Kanıt dosyaları (fatura / ölçüm ekranı görüntüsü)
CREATE TABLE IF NOT EXISTS public.hotel_carbon_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_start DATE NOT NULL REFERENCES public.hotel_carbon_monthly_inputs(month_start) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_label TEXT,
  mime_type TEXT,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotel_carbon_evidence_month ON public.hotel_carbon_evidence (month_start DESC);

ALTER TABLE public.hotel_carbon_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hotel_carbon_evidence_admin_all" ON public.hotel_carbon_evidence;
CREATE POLICY "hotel_carbon_evidence_admin_all"
ON public.hotel_carbon_evidence
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_id = auth.uid() AND s.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_id = auth.uid() AND s.role = 'admin'
  )
);

-- Ay için toplam konaklama gecesi (override veya guests toplamı)
CREATE OR REPLACE FUNCTION public.carbon_month_occupancy_nights(p_month_start DATE)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_override NUMERIC;
BEGIN
  SELECT i.occupancy_nights_override INTO v_override
  FROM public.hotel_carbon_monthly_inputs i
  WHERE i.month_start = p_month_start;

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  RETURN COALESCE((
    SELECT SUM(
      GREATEST(
        COALESCE(g2.nights_count, 0),
        CASE
          WHEN g2.check_in_at IS NULL THEN 0::numeric
          WHEN g2.check_out_at IS NULL THEN
            GREATEST(
              1::numeric,
              CEIL(EXTRACT(EPOCH FROM (date_trunc('month', p_month_start::timestamp) + interval '1 month' - g2.check_in_at)) / 86400.0)
            )
          ELSE
            GREATEST(
              1::numeric,
              CEIL(EXTRACT(EPOCH FROM (g2.check_out_at - g2.check_in_at)) / 86400.0)
            )
        END
      )
    )
    FROM public.guests g2
    WHERE g2.deleted_at IS NULL
      AND g2.check_in_at IS NOT NULL
      AND date_trunc('month', g2.check_in_at)::date = p_month_start
  ), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.carbon_month_occupancy_nights(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.carbon_month_occupancy_nights(DATE) TO authenticated;

-- Misafir ekranı: metodoloji ve kaynak metinleri
-- Dönüş tipi değiştiği için önce düşürülmeli (CREATE OR REPLACE yetmez).
DROP FUNCTION IF EXISTS public.get_my_latest_stay_carbon();

CREATE OR REPLACE FUNCTION public.get_my_latest_stay_carbon()
RETURNS TABLE (
  guest_id UUID,
  stay_check_in_at TIMESTAMPTZ,
  stay_check_out_at TIMESTAMPTZ,
  stay_nights NUMERIC,
  month_start DATE,
  occupancy_nights NUMERIC,
  electricity_kwh NUMERIC,
  water_m3 NUMERIC,
  gas_m3 NUMERIC,
  waste_kg NUMERIC,
  electricity_kg_co2 NUMERIC,
  water_kg_co2 NUMERIC,
  gas_kg_co2 NUMERIC,
  waste_kg_co2 NUMERIC,
  total_kg_co2 NUMERIC,
  kg_co2_per_stay_night NUMERIC,
  methodology_version TEXT,
  methodology_summary TEXT,
  electricity_factor_source TEXT,
  water_factor_source TEXT,
  gas_factor_source TEXT,
  waste_factor_source TEXT,
  data_collection_notes TEXT,
  verification_notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  RETURN QUERY
  WITH my_guest AS (
    SELECT g.id, g.check_in_at, g.check_out_at, g.nights_count
    FROM public.guests g
    WHERE g.auth_user_id = v_uid
      AND g.check_in_at IS NOT NULL
      AND g.deleted_at IS NULL
    ORDER BY COALESCE(g.check_out_at, g.check_in_at) DESC
    LIMIT 1
  ),
  month_input AS (
    SELECT i.*
    FROM my_guest mg
    JOIN public.hotel_carbon_monthly_inputs i
      ON i.month_start = date_trunc('month', mg.check_in_at)::date
    LIMIT 1
  ),
  occupancy AS (
    SELECT
      mi.month_start,
      COALESCE(
        mi.occupancy_nights_override,
        NULLIF((
          SELECT SUM(
            GREATEST(
              COALESCE(g2.nights_count, 0),
              CASE
                WHEN g2.check_in_at IS NULL THEN 0
                WHEN g2.check_out_at IS NULL THEN
                  GREATEST(
                    1,
                    CEIL(EXTRACT(EPOCH FROM (date_trunc('month', mi.month_start) + interval '1 month' - g2.check_in_at)) / 86400.0)
                  )::numeric
                ELSE
                  GREATEST(
                    1,
                    CEIL(EXTRACT(EPOCH FROM (g2.check_out_at - g2.check_in_at)) / 86400.0)
                  )::numeric
              END
            )
          )
          FROM public.guests g2
          WHERE g2.deleted_at IS NULL
            AND g2.check_in_at IS NOT NULL
            AND date_trunc('month', g2.check_in_at)::date = mi.month_start
        ), 0)
      ) AS total_nights
    FROM month_input mi
  ),
  calc AS (
    SELECT
      mg.id AS guest_id,
      mg.check_in_at,
      mg.check_out_at,
      GREATEST(
        COALESCE(mg.nights_count, 0),
        CASE
          WHEN mg.check_out_at IS NULL THEN 1
          ELSE GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM (mg.check_out_at - mg.check_in_at)) / 86400.0)
          )::numeric
        END
      ) AS guest_nights,
      mi.month_start,
      o.total_nights,
      mi.electricity_kwh,
      mi.water_m3,
      mi.gas_m3,
      mi.waste_kg,
      mi.electricity_factor,
      mi.water_factor,
      mi.gas_factor,
      mi.waste_factor,
      mi.methodology_version,
      mi.methodology_summary,
      mi.electricity_factor_source,
      mi.water_factor_source,
      mi.gas_factor_source,
      mi.waste_factor_source,
      mi.data_collection_notes,
      mi.verification_notes
    FROM my_guest mg
    JOIN month_input mi ON true
    JOIN occupancy o ON o.month_start = mi.month_start
  ),
  agg AS (
    SELECT
      c.*,
      ROUND(
        ((c.electricity_kwh * c.guest_nights / NULLIF(c.total_nights, 0)) * c.electricity_factor)
        + ((c.water_m3 * c.guest_nights / NULLIF(c.total_nights, 0)) * c.water_factor)
        + ((c.gas_m3 * c.guest_nights / NULLIF(c.total_nights, 0)) * c.gas_factor)
        + ((c.waste_kg * c.guest_nights / NULLIF(c.total_nights, 0)) * c.waste_factor),
        2
      ) AS total_calc
    FROM calc c
    WHERE c.total_nights > 0
  )
  SELECT
    a.guest_id,
    a.check_in_at,
    a.check_out_at,
    a.guest_nights,
    a.month_start,
    a.total_nights,
    ROUND((a.electricity_kwh * a.guest_nights / NULLIF(a.total_nights, 0)), 2) AS electricity_kwh,
    ROUND((a.water_m3 * a.guest_nights / NULLIF(a.total_nights, 0)), 2) AS water_m3,
    ROUND((a.gas_m3 * a.guest_nights / NULLIF(a.total_nights, 0)), 2) AS gas_m3,
    ROUND((a.waste_kg * a.guest_nights / NULLIF(a.total_nights, 0)), 2) AS waste_kg,
    ROUND((a.electricity_kwh * a.guest_nights / NULLIF(a.total_nights, 0)) * a.electricity_factor, 2) AS electricity_kg_co2,
    ROUND((a.water_m3 * a.guest_nights / NULLIF(a.total_nights, 0)) * a.water_factor, 2) AS water_kg_co2,
    ROUND((a.gas_m3 * a.guest_nights / NULLIF(a.total_nights, 0)) * a.gas_factor, 2) AS gas_kg_co2,
    ROUND((a.waste_kg * a.guest_nights / NULLIF(a.total_nights, 0)) * a.waste_factor, 2) AS waste_kg_co2,
    a.total_calc AS total_kg_co2,
    ROUND(a.total_calc / NULLIF(a.guest_nights, 0), 3) AS kg_co2_per_stay_night,
    a.methodology_version,
    a.methodology_summary,
    a.electricity_factor_source,
    a.water_factor_source,
    a.gas_factor_source,
    a.waste_factor_source,
    a.data_collection_notes,
    a.verification_notes
  FROM agg a;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_latest_stay_carbon() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_latest_stay_carbon() TO authenticated;

-- Storage: karbon kanıtları
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'carbon-evidence',
  'carbon-evidence',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "carbon_evidence_read" ON storage.objects;
CREATE POLICY "carbon_evidence_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'carbon-evidence');

DROP POLICY IF EXISTS "carbon_evidence_upload" ON storage.objects;
CREATE POLICY "carbon_evidence_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'carbon-evidence'
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_id = auth.uid() AND s.role = 'admin'
  )
);

DROP POLICY IF EXISTS "carbon_evidence_update" ON storage.objects;
CREATE POLICY "carbon_evidence_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'carbon-evidence'
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_id = auth.uid() AND s.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'carbon-evidence'
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_id = auth.uid() AND s.role = 'admin'
  )
);

COMMIT;
