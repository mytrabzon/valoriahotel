BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  topic_type text NOT NULL DEFAULT 'complaint' CHECK (topic_type IN ('complaint', 'suggestion', 'thanks')),
  category text NOT NULL CHECK (
    category IN (
      'personnel',
      'room_issue',
      'payment',
      'reception_checkin_checkout',
      'passport',
      'noise',
      'breakfast',
      'food',
      'other'
    )
  ),
  description text NOT NULL CHECK (char_length(btrim(description)) >= 5),
  phone text,
  room_number text,
  image_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  admin_note text,
  reviewed_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_complaints_guest_idx
  ON public.guest_complaints (guest_id, created_at DESC);

CREATE INDEX IF NOT EXISTS guest_complaints_status_idx
  ON public.guest_complaints (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.guest_complaints_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guest_complaints_updated_at ON public.guest_complaints;
CREATE TRIGGER trg_guest_complaints_updated_at
  BEFORE UPDATE ON public.guest_complaints
  FOR EACH ROW EXECUTE FUNCTION public.guest_complaints_set_updated_at();

ALTER TABLE public.guest_complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_complaints_select_own" ON public.guest_complaints;
CREATE POLICY "guest_complaints_select_own"
  ON public.guest_complaints
  FOR SELECT TO authenticated
  USING (
    guest_id IN (
      SELECT g.id
      FROM public.guests g
      WHERE g.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guest_complaints_insert_own" ON public.guest_complaints;
CREATE POLICY "guest_complaints_insert_own"
  ON public.guest_complaints
  FOR INSERT TO authenticated
  WITH CHECK (
    guest_id IN (
      SELECT g.id
      FROM public.guests g
      WHERE g.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "guest_complaints_staff_read" ON public.guest_complaints;
CREATE POLICY "guest_complaints_staff_read"
  ON public.guest_complaints
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND COALESCE(s.is_active, true) = true
        AND s.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "guest_complaints_staff_update" ON public.guest_complaints;
CREATE POLICY "guest_complaints_staff_update"
  ON public.guest_complaints
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND COALESCE(s.is_active, true) = true
        AND s.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND COALESCE(s.is_active, true) = true
        AND s.deleted_at IS NULL
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('guest-complaints', 'guest-complaints', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "guest_complaints_bucket_read" ON storage.objects;
CREATE POLICY "guest_complaints_bucket_read"
  ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'guest-complaints');

DROP POLICY IF EXISTS "guest_complaints_bucket_insert" ON storage.objects;
CREATE POLICY "guest_complaints_bucket_insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'guest-complaints'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "guest_complaints_bucket_update_admin" ON storage.objects;
CREATE POLICY "guest_complaints_bucket_update_admin"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'guest-complaints'
    AND public.current_user_is_staff_admin()
  )
  WITH CHECK (bucket_id = 'guest-complaints');

DROP POLICY IF EXISTS "guest_complaints_bucket_delete_admin" ON storage.objects;
CREATE POLICY "guest_complaints_bucket_delete_admin"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'guest-complaints'
    AND public.current_user_is_staff_admin()
  );

GRANT SELECT, INSERT, UPDATE ON public.guest_complaints TO authenticated;

COMMIT;
