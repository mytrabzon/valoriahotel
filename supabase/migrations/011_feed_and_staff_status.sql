-- Valoria Hotel - Canlı akış (feed) ve personel durumu (work_status)
-- Paylaşım görünürlüğü: all_staff, my_team, managers_only, customers (müşteri ana sayfada görsün)

-- ========== 1. Staff: çalışma durumu (story avatar renkleri) ==========
-- 🟢 active, 🟡 break, 🔴 off, ⚪ leave
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS work_status TEXT DEFAULT 'active'
  CHECK (work_status IN ('active', 'break', 'off', 'leave'));

COMMENT ON COLUMN public.staff.work_status IS 'active=çalışıyor, break=molada, off=mesai bitti, leave=izinli/raporlu';

-- ========== 2. Feed paylaşımları (personel foto/video) ==========
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  -- Kimler görebilir: customers = müşteri ana sayfada görür
  visibility TEXT NOT NULL DEFAULT 'all_staff'
    CHECK (visibility IN ('all_staff', 'my_team', 'managers_only', 'customers')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_staff ON public.feed_posts(staff_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created ON public.feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_visibility ON public.feed_posts(visibility);

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

-- Müşteri: sadece visibility = 'customers' olanları görür (anon/authenticated guest)
DROP POLICY IF EXISTS "feed_posts_customers" ON public.feed_posts;
CREATE POLICY "feed_posts_customers" ON public.feed_posts FOR SELECT TO authenticated, anon
  USING (visibility = 'customers');

-- Personel: all_staff VEYA my_team (aynı departman) VEYA managers_only (admin) görür
DROP POLICY IF EXISTS "feed_posts_staff" ON public.feed_posts;
CREATE POLICY "feed_posts_staff" ON public.feed_posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid()
      AND (
        visibility = 'all_staff'
        OR (visibility = 'my_team' AND s.department = (SELECT department FROM public.staff WHERE id = feed_posts.staff_id))
        OR (visibility = 'managers_only' AND s.role = 'admin')
        OR visibility = 'customers'
      )
    )
  );

-- Personel kendi paylaşımını ekleyebilir
DROP POLICY IF EXISTS "feed_posts_insert_staff" ON public.feed_posts;
CREATE POLICY "feed_posts_insert_staff" ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff WHERE id = staff_id AND auth_id = auth.uid())
  );

-- Admin tüm paylaşımları görür / silebilir
DROP POLICY IF EXISTS "feed_posts_admin_all" ON public.feed_posts;
CREATE POLICY "feed_posts_admin_all" ON public.feed_posts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid() AND role = 'admin'));

-- ========== 3. Beğeni (opsiyonel, ileride) ==========
CREATE TABLE IF NOT EXISTS public.feed_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_reactions_post ON public.feed_post_reactions(post_id);
ALTER TABLE public.feed_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_reactions_staff" ON public.feed_post_reactions;
CREATE POLICY "feed_reactions_staff" ON public.feed_post_reactions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid()));

-- ========== 4. Storage: feed paylaşım medyası ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed-media',
  'feed-media',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "feed_media_staff_upload" ON storage.objects;
CREATE POLICY "feed_media_staff_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feed-media'
    AND EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "feed_media_public_read" ON storage.objects;
CREATE POLICY "feed_media_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'feed-media');
