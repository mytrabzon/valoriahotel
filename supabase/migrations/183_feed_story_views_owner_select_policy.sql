-- Story sahibi kendi story'sinin tum goruntuleyenlerini gorebilsin.
-- Ayrica aktif story satirlari personel tarafinda okunabilir kalir.

ALTER TABLE public.feed_story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_story_views_staff_select" ON public.feed_story_views;
CREATE POLICY "feed_story_views_staff_select"
  ON public.feed_story_views
  FOR SELECT
  TO authenticated
  USING (
    -- kendi view satirini gorebilir
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR
    -- story sahibi, kendi story'sinin tum viewer satirlarini gorebilir
    EXISTS (
      SELECT 1
      FROM public.feed_stories fs
      WHERE fs.id = story_id
        AND fs.staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    )
    OR
    -- aktif/silinmemis story satirlari ekipte gorulebilir
    EXISTS (
      SELECT 1
      FROM public.feed_stories fs
      WHERE fs.id = story_id
        AND fs.deleted_at IS NULL
        AND fs.expires_at > now()
    )
  );
