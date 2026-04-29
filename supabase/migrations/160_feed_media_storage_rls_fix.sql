/* feed-media storage.objects: INSERT politikasi drift veya eski policy kalintisinda
   dogrudan yukleme RLS hatasi verebilir. Politikalari yeniden olusturur. */

DROP POLICY IF EXISTS "feed_media_staff_upload" ON storage.objects;
DROP POLICY IF EXISTS "feed_media_guest_upload" ON storage.objects;

DROP POLICY IF EXISTS "feed_media_public_read" ON storage.objects;
CREATE POLICY "feed_media_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'feed-media');

DROP POLICY IF EXISTS "feed_media_upload" ON storage.objects;
CREATE POLICY "feed_media_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-media');

DROP POLICY IF EXISTS "feed_media_update" ON storage.objects;
CREATE POLICY "feed_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'feed-media')
  WITH CHECK (bucket_id = 'feed-media');
