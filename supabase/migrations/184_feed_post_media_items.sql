-- Feed paylasimlari icin coklu medya destegi

CREATE TABLE IF NOT EXISTS public.feed_post_media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_post_media_items_post
  ON public.feed_post_media_items(post_id, sort_order, created_at);

ALTER TABLE public.feed_post_media_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_post_media_items_select_all" ON public.feed_post_media_items;
CREATE POLICY "feed_post_media_items_select_all"
  ON public.feed_post_media_items
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "feed_post_media_items_insert_owner" ON public.feed_post_media_items;
CREATE POLICY "feed_post_media_items_insert_owner"
  ON public.feed_post_media_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.feed_posts fp
      WHERE fp.id = post_id
        AND (
          fp.staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
          OR fp.guest_id IN (SELECT id FROM public.guests WHERE auth_user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "feed_post_media_items_delete_owner_or_admin" ON public.feed_post_media_items;
CREATE POLICY "feed_post_media_items_delete_owner_or_admin"
  ON public.feed_post_media_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.feed_posts fp
      WHERE fp.id = post_id
        AND (
          fp.staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
          OR fp.guest_id IN (SELECT id FROM public.guests WHERE auth_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
        )
    )
  );
