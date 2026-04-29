-- Story goruntulemelerinde misafirleri de kaydet.

ALTER TABLE public.feed_story_views
  ADD COLUMN IF NOT EXISTS guest_id UUID NULL REFERENCES public.guests(id) ON DELETE CASCADE;

ALTER TABLE public.feed_story_views
  ALTER COLUMN staff_id DROP NOT NULL;

ALTER TABLE public.feed_story_views
  DROP CONSTRAINT IF EXISTS feed_story_views_story_id_staff_id_key;

ALTER TABLE public.feed_story_views
  DROP CONSTRAINT IF EXISTS feed_story_views_single_viewer_chk;

ALTER TABLE public.feed_story_views
  ADD CONSTRAINT feed_story_views_single_viewer_chk
  CHECK (num_nonnulls(staff_id, guest_id) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_story_views_story_staff
  ON public.feed_story_views(story_id, staff_id)
  WHERE staff_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_story_views_story_guest
  ON public.feed_story_views(story_id, guest_id)
  WHERE guest_id IS NOT NULL;

DROP POLICY IF EXISTS "feed_story_views_staff_insert_own" ON public.feed_story_views;
CREATE POLICY "feed_story_views_staff_insert_own"
  ON public.feed_story_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
      AND guest_id IS NULL
    )
    OR (
      guest_id IS NOT NULL
      AND staff_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.guests g
        WHERE g.id = guest_id
          AND (
            ((auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email')))
            OR g.auth_user_id = auth.uid()
          )
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.feed_stories fs
      WHERE fs.id = story_id
        AND fs.deleted_at IS NULL
        AND fs.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "feed_story_views_staff_update_own" ON public.feed_story_views;
CREATE POLICY "feed_story_views_staff_update_own"
  ON public.feed_story_views
  FOR UPDATE
  TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR (
      guest_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.guests g
        WHERE g.id = guest_id
          AND (
            ((auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email')))
            OR g.auth_user_id = auth.uid()
          )
      )
    )
  )
  WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR (
      guest_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.guests g
        WHERE g.id = guest_id
          AND (
            ((auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email')))
            OR g.auth_user_id = auth.uid()
          )
      )
    )
  );
