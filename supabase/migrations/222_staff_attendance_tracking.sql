BEGIN;

-- Staff attendance core module (shift-aware, location-aware, auditable)

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS grace_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer NOT NULL DEFAULT 250;

ALTER TABLE public.hotel_info
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS attendance_geofence_radius_m integer NOT NULL DEFAULT 250;

CREATE TABLE IF NOT EXISTS public.staff_attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('check_in', 'break_start', 'break_end', 'check_out', 'late_notice', 'manual_request')),
  event_time timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'mobile' CHECK (source IN ('mobile', 'admin', 'system', 'offline_sync')),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  distance_to_hotel_m integer,
  location_status text NOT NULL DEFAULT 'missing' CHECK (location_status IN ('verified', 'outside_hotel_radius', 'missing', 'unavailable')),
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_events_staff_time
  ON public.staff_attendance_events(staff_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_events_type_time
  ON public.staff_attendance_events(event_type, event_time DESC);

ALTER TABLE public.staff_attendance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_attendance_events_select_own_or_admin" ON public.staff_attendance_events;
CREATE POLICY "staff_attendance_events_select_own_or_admin"
  ON public.staff_attendance_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND (s.id = staff_attendance_events.staff_id OR s.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "staff_attendance_events_insert_own_or_admin" ON public.staff_attendance_events;
CREATE POLICY "staff_attendance_events_insert_own_or_admin"
  ON public.staff_attendance_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND (s.id = staff_attendance_events.staff_id OR s.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "staff_attendance_events_update_admin_only" ON public.staff_attendance_events;
CREATE POLICY "staff_attendance_events_update_admin_only"
  ON public.staff_attendance_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND s.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND s.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.get_my_staff_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT s.id
  FROM public.staff s
  WHERE s.auth_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.haversine_distance_m(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round(
    6371000 * 2 * asin(
      sqrt(
        power(sin(radians((p_lat2 - p_lat1) / 2)), 2) +
        cos(radians(p_lat1)) * cos(radians(p_lat2)) *
        power(sin(radians((p_lon2 - p_lon1) / 2)), 2)
      )
    )
  )::integer;
$$;

CREATE OR REPLACE FUNCTION public.staff_attendance_check_in(
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy_m double precision DEFAULT NULL,
  p_device_info jsonb DEFAULT '{}'::jsonb,
  p_note text DEFAULT NULL,
  p_event_time timestamptz DEFAULT now(),
  p_source text DEFAULT 'mobile'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_hotel_lat double precision;
  v_hotel_lon double precision;
  v_geo_radius integer := 250;
  v_distance integer;
  v_location_status text := 'missing';
  v_shift_start time;
  v_shift_grace integer := 5;
  v_shift_start_ts timestamptz;
  v_late_minutes integer := 0;
  v_today date := (p_event_time AT TIME ZONE 'Europe/Istanbul')::date;
  v_existing_checkin uuid;
BEGIN
  v_staff_id := public.get_my_staff_id();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Personel kaydi bulunamadi';
  END IF;

  SELECT e.id
  INTO v_existing_checkin
  FROM public.staff_attendance_events e
  WHERE e.staff_id = v_staff_id
    AND e.event_type = 'check_in'
    AND (e.event_time AT TIME ZONE 'Europe/Istanbul')::date = v_today
  LIMIT 1;

  IF v_existing_checkin IS NOT NULL THEN
    RAISE EXCEPTION 'Bugun zaten giris yapildi';
  END IF;

  SELECT hi.latitude, hi.longitude, hi.attendance_geofence_radius_m
  INTO v_hotel_lat, v_hotel_lon, v_geo_radius
  FROM public.hotel_info hi
  ORDER BY hi.created_at ASC
  LIMIT 1;

  SELECT sh.start_time, sh.grace_minutes
  INTO v_shift_start, v_shift_grace
  FROM public.staff s
  LEFT JOIN public.shifts sh ON sh.id = s.shift_id
  WHERE s.id = v_staff_id;

  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND v_hotel_lat IS NOT NULL AND v_hotel_lon IS NOT NULL THEN
    v_distance := public.haversine_distance_m(p_latitude, p_longitude, v_hotel_lat, v_hotel_lon);
    IF v_distance <= COALESCE(v_geo_radius, 250) THEN
      v_location_status := 'verified';
    ELSE
      v_location_status := 'outside_hotel_radius';
      RAISE EXCEPTION 'Konum dogrulanamadi';
    END IF;
  ELSIF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    v_location_status := 'unavailable';
  END IF;

  IF v_shift_start IS NOT NULL THEN
    v_shift_start_ts := (v_today::text || ' ' || v_shift_start::text || '+03')::timestamptz;
    v_late_minutes := GREATEST(0, floor(extract(epoch FROM (p_event_time - (v_shift_start_ts + make_interval(mins => COALESCE(v_shift_grace, 5))))) / 60)::integer);
  END IF;

  INSERT INTO public.staff_attendance_events (
    staff_id,
    event_type,
    event_time,
    source,
    latitude,
    longitude,
    accuracy_m,
    distance_to_hotel_m,
    location_status,
    device_info,
    note,
    metadata,
    created_by_staff_id
  ) VALUES (
    v_staff_id,
    'check_in',
    p_event_time,
    COALESCE(NULLIF(trim(p_source), ''), 'mobile'),
    p_latitude,
    p_longitude,
    p_accuracy_m,
    v_distance,
    v_location_status,
    COALESCE(p_device_info, '{}'::jsonb),
    p_note,
    jsonb_build_object('late_minutes', v_late_minutes),
    v_staff_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'staff_id', v_staff_id,
    'event_time', p_event_time,
    'late_minutes', v_late_minutes,
    'location_status', v_location_status,
    'distance_to_hotel_m', v_distance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_attendance_check_out(
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy_m double precision DEFAULT NULL,
  p_device_info jsonb DEFAULT '{}'::jsonb,
  p_note text DEFAULT NULL,
  p_event_time timestamptz DEFAULT now(),
  p_source text DEFAULT 'mobile'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_hotel_lat double precision;
  v_hotel_lon double precision;
  v_geo_radius integer := 250;
  v_distance integer;
  v_location_status text := 'missing';
  v_today date := (p_event_time AT TIME ZONE 'Europe/Istanbul')::date;
  v_has_checkin boolean := false;
  v_has_checkout boolean := false;
BEGIN
  v_staff_id := public.get_my_staff_id();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Personel kaydi bulunamadi';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.staff_attendance_events e
    WHERE e.staff_id = v_staff_id
      AND e.event_type = 'check_in'
      AND (e.event_time AT TIME ZONE 'Europe/Istanbul')::date = v_today
  ) INTO v_has_checkin;

  IF NOT v_has_checkin THEN
    RAISE EXCEPTION 'Bugun giris kaydi bulunamadi';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.staff_attendance_events e
    WHERE e.staff_id = v_staff_id
      AND e.event_type = 'check_out'
      AND (e.event_time AT TIME ZONE 'Europe/Istanbul')::date = v_today
  ) INTO v_has_checkout;

  IF v_has_checkout THEN
    RAISE EXCEPTION 'Bugun zaten cikis yapildi';
  END IF;

  SELECT hi.latitude, hi.longitude, hi.attendance_geofence_radius_m
  INTO v_hotel_lat, v_hotel_lon, v_geo_radius
  FROM public.hotel_info hi
  ORDER BY hi.created_at ASC
  LIMIT 1;

  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND v_hotel_lat IS NOT NULL AND v_hotel_lon IS NOT NULL THEN
    v_distance := public.haversine_distance_m(p_latitude, p_longitude, v_hotel_lat, v_hotel_lon);
    IF v_distance <= COALESCE(v_geo_radius, 250) THEN
      v_location_status := 'verified';
    ELSE
      v_location_status := 'outside_hotel_radius';
      RAISE EXCEPTION 'Konum dogrulanamadi';
    END IF;
  ELSIF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    v_location_status := 'unavailable';
  END IF;

  INSERT INTO public.staff_attendance_events (
    staff_id,
    event_type,
    event_time,
    source,
    latitude,
    longitude,
    accuracy_m,
    distance_to_hotel_m,
    location_status,
    device_info,
    note,
    created_by_staff_id
  ) VALUES (
    v_staff_id,
    'check_out',
    p_event_time,
    COALESCE(NULLIF(trim(p_source), ''), 'mobile'),
    p_latitude,
    p_longitude,
    p_accuracy_m,
    v_distance,
    v_location_status,
    COALESCE(p_device_info, '{}'::jsonb),
    p_note,
    v_staff_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'staff_id', v_staff_id,
    'event_time', p_event_time,
    'location_status', v_location_status,
    'distance_to_hotel_m', v_distance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_attendance_add_event(
  p_event_type text,
  p_note text DEFAULT NULL,
  p_event_time timestamptz DEFAULT now(),
  p_source text DEFAULT 'mobile'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_event_type text := COALESCE(NULLIF(trim(p_event_type), ''), '');
BEGIN
  v_staff_id := public.get_my_staff_id();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Personel kaydi bulunamadi';
  END IF;

  IF v_event_type NOT IN ('break_start', 'break_end', 'late_notice', 'manual_request') THEN
    RAISE EXCEPTION 'Gecersiz event tipi';
  END IF;

  INSERT INTO public.staff_attendance_events (
    staff_id,
    event_type,
    event_time,
    source,
    location_status,
    note,
    created_by_staff_id
  ) VALUES (
    v_staff_id,
    v_event_type,
    p_event_time,
    COALESCE(NULLIF(trim(p_source), ''), 'mobile'),
    'missing',
    p_note,
    v_staff_id
  );

  RETURN jsonb_build_object('ok', true, 'event_type', v_event_type, 'event_time', p_event_time);
END;
$$;

CREATE OR REPLACE VIEW public.staff_attendance_daily_report AS
WITH dates AS (
  SELECT generate_series((now() AT TIME ZONE 'Europe/Istanbul')::date - interval '90 days', (now() AT TIME ZONE 'Europe/Istanbul')::date, interval '1 day')::date AS work_date
),
staff_dates AS (
  SELECT s.id AS staff_id, s.full_name, s.role, s.shift_id, d.work_date
  FROM public.staff s
  CROSS JOIN dates d
  WHERE COALESCE(s.is_active, true) = true
),
events AS (
  SELECT
    e.staff_id,
    (e.event_time AT TIME ZONE 'Europe/Istanbul')::date AS work_date,
    min(e.event_time) FILTER (WHERE e.event_type = 'check_in') AS check_in_at,
    max(e.event_time) FILTER (WHERE e.event_type = 'check_out') AS check_out_at,
    count(*) FILTER (WHERE e.event_type = 'check_in') AS check_in_count,
    count(*) FILTER (WHERE e.event_type = 'check_out') AS check_out_count
  FROM public.staff_attendance_events e
  GROUP BY e.staff_id, (e.event_time AT TIME ZONE 'Europe/Istanbul')::date
)
SELECT
  sd.work_date,
  sd.staff_id,
  sd.full_name,
  sd.role,
  ev.check_in_at,
  ev.check_out_at,
  CASE
    WHEN ev.check_in_at IS NOT NULL AND ev.check_out_at IS NOT NULL THEN extract(epoch FROM (ev.check_out_at - ev.check_in_at)) / 3600.0
    ELSE NULL
  END AS total_hours,
  sh.start_time,
  sh.end_time,
  sh.grace_minutes,
  CASE
    WHEN ev.check_in_at IS NULL THEN NULL
    WHEN sh.start_time IS NULL THEN 0
    ELSE GREATEST(
      0,
      floor(
        extract(
          epoch FROM (
            ev.check_in_at
            - ((sd.work_date::text || ' ' || sh.start_time::text || '+03')::timestamptz + make_interval(mins => COALESCE(sh.grace_minutes, 5)))
          )
        ) / 60
      )::integer
    )
  END AS late_minutes,
  CASE
    WHEN ev.check_in_count IS NULL OR ev.check_in_count = 0 THEN 'devamsiz'
    WHEN ev.check_in_count > 0 AND (ev.check_out_count IS NULL OR ev.check_out_count = 0) THEN 'eksik_kayit'
    WHEN sh.start_time IS NOT NULL
      AND ev.check_in_at > ((sd.work_date::text || ' ' || sh.start_time::text || '+03')::timestamptz + make_interval(mins => COALESCE(sh.grace_minutes, 5)))
      THEN 'gec_geldi'
    WHEN sh.end_time IS NOT NULL
      AND ev.check_out_at IS NOT NULL
      AND ev.check_out_at < ((sd.work_date::text || ' ' || sh.end_time::text || '+03')::timestamptz)
      THEN 'erken_cikti'
    ELSE 'zamaninda'
  END AS day_status
FROM staff_dates sd
LEFT JOIN events ev ON ev.staff_id = sd.staff_id AND ev.work_date = sd.work_date
LEFT JOIN public.shifts sh ON sh.id = sd.shift_id;

CREATE OR REPLACE FUNCTION public.get_my_attendance_today()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_today date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_report jsonb;
  v_events jsonb;
BEGIN
  v_staff_id := public.get_my_staff_id();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Personel kaydi bulunamadi';
  END IF;

  SELECT to_jsonb(r.*)
  INTO v_report
  FROM public.staff_attendance_daily_report r
  WHERE r.staff_id = v_staff_id
    AND r.work_date = v_today
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.event_time), '[]'::jsonb)
  INTO v_events
  FROM public.staff_attendance_events e
  WHERE e.staff_id = v_staff_id
    AND (e.event_time AT TIME ZONE 'Europe/Istanbul')::date = v_today;

  RETURN jsonb_build_object(
    'today', v_today,
    'report', COALESCE(v_report, '{}'::jsonb),
    'events', v_events
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_attendance_check_in(double precision, double precision, double precision, jsonb, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_attendance_check_out(double precision, double precision, double precision, jsonb, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_attendance_add_event(text, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_attendance_today() TO authenticated;

COMMIT;
