-- Görüntüleyenler: hangi personel hangi paylaşımı gördü
CREATE TABLE IF NOT EXISTS public.feed_post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_post_views_post ON public.feed_post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_post_views_staff ON public.feed_post_views(staff_id);

ALTER TABLE public.feed_post_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_views_staff" ON public.feed_post_views;
CREATE POLICY "feed_views_staff" ON public.feed_post_views FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid()));

-- Paylaşım bazlı "yorum bildirimi al" tercihi
CREATE TABLE IF NOT EXISTS public.feed_post_notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_notif_prefs_post ON public.feed_post_notification_prefs(post_id);

ALTER TABLE public.feed_post_notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_notif_prefs_staff" ON public.feed_post_notification_prefs;
CREATE POLICY "feed_notif_prefs_staff" ON public.feed_post_notification_prefs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid()));
