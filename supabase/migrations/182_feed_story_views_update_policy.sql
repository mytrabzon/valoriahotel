-- feed_story_views upsert cakisinca UPDATE policy gerekli

ALTER TABLE public.feed_story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_story_views_staff_update_own" ON public.feed_story_views;
CREATE POLICY "feed_story_views_staff_update_own"
  ON public.feed_story_views
  FOR UPDATE
  TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );
