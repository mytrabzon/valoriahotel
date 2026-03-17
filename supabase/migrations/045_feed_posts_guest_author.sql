-- Müşteri (guest) tarafından da paylaşım yapılabilsin; staff_id veya guest_id biri dolu olacak.
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE;
ALTER TABLE public.feed_posts ALTER COLUMN staff_id DROP NOT NULL;

-- En az biri dolu olmalı
ALTER TABLE public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_author_check;
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_author_check CHECK (
  (staff_id IS NOT NULL AND guest_id IS NULL) OR (staff_id IS NULL AND guest_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_guest ON public.feed_posts(guest_id);

-- Müşteri (staff değilse) sadece kendi guest kaydı ile, visibility = 'customers' ile ekleyebilir
DROP POLICY IF EXISTS "feed_posts_insert_guest" ON public.feed_posts;
CREATE POLICY "feed_posts_insert_guest" ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IS NULL
    AND guest_id IS NOT NULL
    AND visibility = 'customers'
    AND NOT EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.id = guest_id AND g.email = (auth.jwt()->>'email')
    )
  );

-- Storage: misafir de feed-media'ya yükleyebilsin (path: guest_<uuid>/...)
DROP POLICY IF EXISTS "feed_media_guest_upload" ON storage.objects;
CREATE POLICY "feed_media_guest_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feed-media'
    AND (storage.foldername(name))[1] LIKE 'guest_%'
    AND EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.email = (auth.jwt()->>'email')
      AND (auth.jwt()->>'email') IS NOT NULL
    )
  );

COMMENT ON COLUMN public.feed_posts.guest_id IS 'Misafir paylaşımında yazar; staff_id null olur.';
