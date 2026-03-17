-- Feed paylaşımlarına yorum ve beğeni bildirimleri için yorum tablosu
CREATE TABLE IF NOT EXISTS public.feed_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_post_comments_post ON public.feed_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_post_comments_created ON public.feed_post_comments(created_at);

ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_comments_staff" ON public.feed_post_comments;
CREATE POLICY "feed_comments_staff" ON public.feed_post_comments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid()));
