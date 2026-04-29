-- Misafir uygulamasinda da aktif story goruntuleme.
-- Story olusturma/etkilesim yetkileri personelde kalir; misafir sadece okur.

ALTER TABLE public.feed_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_stories_staff_select_active" ON public.feed_stories;
CREATE POLICY "feed_stories_staff_select_active"
  ON public.feed_stories
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND expires_at > now()
  );
