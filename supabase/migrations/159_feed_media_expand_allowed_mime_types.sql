-- feed-media: bazı Android/iOS cihazlar video için video/mp4 yerine video/3gpp, application/octet-stream vb. gönderir;
-- allowed_mime_types dar kalınca Storage yükleme reddedilir (RLS / "policy" hatası gibi görünebilir).

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
  'video/mpeg',
  'video/x-matroska',
  'application/mp4'
]::text[]
WHERE id = 'feed-media';
