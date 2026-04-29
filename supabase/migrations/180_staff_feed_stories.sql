-- Staff story sistemi (24 saatlik)

CREATE TABLE IF NOT EXISTS public.feed_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT NULL,
  caption TEXT NULL,
  visibility TEXT NOT NULL DEFAULT 'all_staff' CHECK (visibility IN ('all_staff')),
  duration_seconds INTEGER NOT NULL DEFAULT 24 CHECK (duration_seconds >= 5 AND duration_seconds <= 60),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_feed_stories_staff_created
  ON public.feed_stories(staff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_stories_active
  ON public.feed_stories(expires_at, deleted_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.feed_story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.feed_stories(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_story_views_story
  ON public.feed_story_views(story_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_story_views_staff
  ON public.feed_story_views(staff_id, viewed_at DESC);

ALTER TABLE public.feed_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_stories_staff_select_active" ON public.feed_stories;
CREATE POLICY "feed_stories_staff_select_active"
  ON public.feed_stories
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND expires_at > now()
    AND EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "feed_stories_staff_insert_own" ON public.feed_stories;
CREATE POLICY "feed_stories_staff_insert_own"
  ON public.feed_stories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "feed_stories_staff_delete_own_or_admin" ON public.feed_stories;
CREATE POLICY "feed_stories_staff_delete_own_or_admin"
  ON public.feed_stories
  FOR UPDATE
  TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  )
  WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  );

DROP POLICY IF EXISTS "feed_story_views_staff_select" ON public.feed_story_views;
CREATE POLICY "feed_story_views_staff_select"
  ON public.feed_story_views
  FOR SELECT
  TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.feed_stories fs
      WHERE fs.id = story_id
        AND fs.deleted_at IS NULL
        AND fs.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "feed_story_views_staff_insert_own" ON public.feed_story_views;
CREATE POLICY "feed_story_views_staff_insert_own"
  ON public.feed_story_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.feed_stories fs
      WHERE fs.id = story_id
        AND fs.deleted_at IS NULL
        AND fs.expires_at > now()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'feed_stories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_stories;
  END IF;
END $$;
