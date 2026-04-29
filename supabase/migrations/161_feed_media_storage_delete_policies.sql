-- feed-media: paylaşım silinince istemcinin Storage dosyalarını da kaldırabilmesi için DELETE RLS.
-- Üç ayrı politika (OR ile birleşir): kendi auth klasörü, kendi guest_ klasörü, admin.

DROP POLICY IF EXISTS "feed_media_delete_staff_own" ON storage.objects;
CREATE POLICY "feed_media_delete_staff_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'feed-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "feed_media_delete_guest_own" ON storage.objects;
CREATE POLICY "feed_media_delete_guest_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'feed-media'
    AND (storage.foldername(name))[1] LIKE 'guest_%'
    AND NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.guests g
      WHERE (storage.foldername(name))[1] = ('guest_' || g.id::text)
        AND (
          (
            (auth.jwt()->>'email') IS NOT NULL
            AND trim(auth.jwt()->>'email') <> ''
            AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email'))
          )
          OR g.auth_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "feed_media_delete_admin" ON storage.objects;
CREATE POLICY "feed_media_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'feed-media'
    AND EXISTS (SELECT 1 FROM public.admin_auth_ids WHERE auth_id = auth.uid())
  );
