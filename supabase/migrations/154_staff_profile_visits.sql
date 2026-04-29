-- Profil ziyaretleri: personel veya misafir bir personel profilini açtığında kayıt (30 dk içinde tekrar aynı ziyaretçi için tek kayıt).
-- Görüntüleme: sadece profil sahibi kendi ziyaret listesini okuyabilir (RLS + liste RPC).

CREATE TABLE IF NOT EXISTS public.staff_profile_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewed_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  visitor_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  visitor_guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  visited_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_profile_visits_visitor_xor CHECK (
    (visitor_staff_id IS NOT NULL AND visitor_guest_id IS NULL)
    OR (visitor_staff_id IS NULL AND visitor_guest_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_staff_profile_visits_viewed_at
  ON public.staff_profile_visits (viewed_staff_id, visited_at DESC);

ALTER TABLE public.staff_profile_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_profile_visits_select_own" ON public.staff_profile_visits;
CREATE POLICY "staff_profile_visits_select_own"
  ON public.staff_profile_visits FOR SELECT TO authenticated
  USING (
    viewed_staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.auth_id = auth.uid()
    )
  );

COMMENT ON TABLE public.staff_profile_visits IS 'Personel profil sayfası ziyaretleri; INSERT yalnızca record_staff_profile_visit RPC ile.';

CREATE OR REPLACE FUNCTION public.record_staff_profile_visit(p_viewed_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_staff uuid;
  v_my_guest uuid;
  v_exists boolean;
BEGIN
  IF v_uid IS NULL OR p_viewed_staff_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = p_viewed_staff_id
      AND deleted_at IS NULL
      AND COALESCE(is_active, true)
  ) THEN
    RETURN;
  END IF;

  SELECT s.id INTO v_my_staff
  FROM public.staff s
  WHERE s.auth_id = v_uid
    AND s.deleted_at IS NULL
    AND COALESCE(s.is_active, true)
  LIMIT 1;

  IF v_my_staff IS NOT NULL THEN
    IF v_my_staff = p_viewed_staff_id THEN
      RETURN;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.staff_profile_visits v
      WHERE v.viewed_staff_id = p_viewed_staff_id
        AND v.visitor_staff_id = v_my_staff
        AND v.visited_at > now() - interval '30 minutes'
    ) INTO v_exists;
    IF v_exists THEN
      RETURN;
    END IF;
    INSERT INTO public.staff_profile_visits (viewed_staff_id, visitor_staff_id)
    VALUES (p_viewed_staff_id, v_my_staff);
    RETURN;
  END IF;

  SELECT g.id INTO v_my_guest
  FROM public.guests g
  WHERE g.auth_user_id = v_uid
    AND g.deleted_at IS NULL
  LIMIT 1;

  IF v_my_guest IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.staff_profile_visits v
    WHERE v.viewed_staff_id = p_viewed_staff_id
      AND v.visitor_guest_id = v_my_guest
      AND v.visited_at > now() - interval '30 minutes'
  ) INTO v_exists;
  IF v_exists THEN
    RETURN;
  END IF;

  INSERT INTO public.staff_profile_visits (viewed_staff_id, visitor_guest_id)
  VALUES (p_viewed_staff_id, v_my_guest);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_staff_profile_visit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_staff_profile_visits(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  visited_at timestamptz,
  visitor_kind text,
  visitor_name text,
  visitor_photo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_owner uuid;
  v_lim integer;
BEGIN
  SELECT s.id INTO v_owner
  FROM public.staff s
  WHERE s.auth_id = auth.uid()
    AND s.deleted_at IS NULL
    AND COALESCE(s.is_active, true)
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  v_lim := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);

  RETURN QUERY
  SELECT
    v.id,
    v.visited_at,
    (CASE WHEN v.visitor_staff_id IS NOT NULL THEN 'staff' ELSE 'guest' END)::text,
    COALESCE(s.full_name, g.full_name, '—')::text,
    COALESCE(s.profile_image, g.photo_url)::text
  FROM public.staff_profile_visits v
  LEFT JOIN public.staff s ON s.id = v.visitor_staff_id
  LEFT JOIN public.guests g ON g.id = v.visitor_guest_id
  WHERE v.viewed_staff_id = v_owner
  ORDER BY v.visited_at DESC
  LIMIT v_lim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_staff_profile_visits(integer) TO authenticated;
