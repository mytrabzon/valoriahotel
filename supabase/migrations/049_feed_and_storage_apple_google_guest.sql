-- Apple / Google ile giriş: gönderi paylaşma ve mesajlaşma kısıtlarını kaldır.
-- get_or_create_guest_for_caller (046) zaten auth_user_id ile misafir oluşturuyor.
-- Bu migration: feed_posts ve storage politikalarında e-posta ZORUNLU değil; auth_user_id ile eşleşen misafir de yazabilsin.

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
        (auth.jwt()->>'email') IS NOT NULL AND trim(auth.jwt()->>'email') <> '' AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email'))
        OR g.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "feed_media_guest_upload" ON storage.objects;
CREATE POLICY "feed_media_guest_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feed-media'
    AND (storage.foldername(name))[1] LIKE 'guest_%'
    AND EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.id::text = replace((storage.foldername(name))[1], 'guest_', '')
      AND (
        (auth.jwt()->>'email') IS NOT NULL AND trim(auth.jwt()->>'email') <> '' AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email'))
        OR g.auth_user_id = auth.uid()
      )
    )
  );
