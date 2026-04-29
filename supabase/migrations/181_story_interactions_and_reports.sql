-- Story etkileşimleri: begeni, yanit, rapor

CREATE TABLE IF NOT EXISTS public.feed_story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.feed_stories(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'like' CHECK (reaction IN ('like')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_story_reactions_story
  ON public.feed_story_reactions(story_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.feed_story_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.feed_stories(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_story_replies_story
  ON public.feed_story_replies(story_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.feed_story_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.feed_stories(id) ON DELETE CASCADE,
  reporter_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_story_reports_status
  ON public.feed_story_reports(status, created_at DESC);

ALTER TABLE public.feed_story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_story_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_story_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_story_reactions_staff_select" ON public.feed_story_reactions;
CREATE POLICY "feed_story_reactions_staff_select"
  ON public.feed_story_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid()));

DROP POLICY IF EXISTS "feed_story_reactions_staff_insert_own" ON public.feed_story_reactions;
CREATE POLICY "feed_story_reactions_staff_insert_own"
  ON public.feed_story_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.feed_stories fs WHERE fs.id = story_id AND fs.deleted_at IS NULL AND fs.expires_at > now())
  );

DROP POLICY IF EXISTS "feed_story_reactions_staff_delete_own" ON public.feed_story_reactions;
CREATE POLICY "feed_story_reactions_staff_delete_own"
  ON public.feed_story_reactions
  FOR DELETE TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "feed_story_replies_staff_select" ON public.feed_story_replies;
CREATE POLICY "feed_story_replies_staff_select"
  ON public.feed_story_replies
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid()));

DROP POLICY IF EXISTS "feed_story_replies_staff_insert_own" ON public.feed_story_replies;
CREATE POLICY "feed_story_replies_staff_insert_own"
  ON public.feed_story_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.feed_stories fs WHERE fs.id = story_id AND fs.deleted_at IS NULL AND fs.expires_at > now())
  );

DROP POLICY IF EXISTS "feed_story_replies_staff_delete_own_or_admin" ON public.feed_story_replies;
CREATE POLICY "feed_story_replies_staff_delete_own_or_admin"
  ON public.feed_story_replies
  FOR DELETE TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  );

DROP POLICY IF EXISTS "feed_story_reports_staff_insert" ON public.feed_story_reports;
CREATE POLICY "feed_story_reports_staff_insert"
  ON public.feed_story_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.feed_stories fs WHERE fs.id = story_id)
  );

DROP POLICY IF EXISTS "feed_story_reports_admin_select" ON public.feed_story_reports;
CREATE POLICY "feed_story_reports_admin_select"
  ON public.feed_story_reports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin'));
