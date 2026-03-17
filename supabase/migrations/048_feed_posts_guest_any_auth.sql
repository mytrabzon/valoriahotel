-- Misafir hesap dahil gönderi paylaşma: kısıtlamaları kaldır.
-- E-posta ile eşleşme zorunluluğu kaldırıldı; auth_user_id (Apple vb.) ile giriş yapan misafir de paylaşım yapabilir.

DROP POLICY IF EXISTS "feed_posts_insert_guest" ON public.feed_posts;
CREATE POLICY "feed_posts_insert_guest" ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IS NULL
    AND guest_id IS NOT NULL
    AND visibility = 'customers'
    AND NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.id = guest_id
      AND (
        (auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email'))
        OR g.auth_user_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY "feed_posts_insert_guest" ON public.feed_posts IS
  'Misafir (e-posta veya auth_user_id ile eşleşen) sadece kendi guest_id ile visibility=customers paylaşım ekleyebilir.';

-- Storage: misafir sadece kendi guest_<id> klasörüne yükleyebilir (e-posta veya auth_user_id ile eşleşen)
DROP POLICY IF EXISTS "feed_media_guest_upload" ON storage.objects;
CREATE POLICY "feed_media_guest_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feed-media'
    AND (storage.foldername(name))[1] LIKE 'guest_%'
    AND EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.id::text = replace((storage.foldername(name))[1], 'guest_', '')
      AND (
        (auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email'))
        OR g.auth_user_id = auth.uid()
      )
    )
  );
