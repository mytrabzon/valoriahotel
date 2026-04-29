-- feed-media: mobil cihazlarda video genelde video/mp4 yerine video/quicktime vb. ile etiketlenebilir;
-- bucket allowed_mime_types dar kalırsa yükleme reddedilir (bazen genel RLS hatası gibi görünür).
-- storage.objects politikaları 149 ile uyumlu tutulur (authenticated INSERT/UPDATE, public SELECT).

DROP POLICY IF EXISTS "feed_media_staff_upload" ON storage.objects;
DROP POLICY IF EXISTS "feed_media_guest_upload" ON storage.objects;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed-media',
  'feed-media',
  true,
  157286400,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
