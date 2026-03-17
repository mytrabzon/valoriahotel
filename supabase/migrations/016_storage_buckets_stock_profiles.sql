-- Valoria Hotel - Storage: stok kanıt fotoğrafları ve profil resimleri
-- Bu bucket'lar stok girişi fotoğrafı ve personel profil fotoğrafı yüklemesi için kullanılır.

-- 1. stock-proofs: Stok girişi çalışan/ürün fotoğrafları
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stock-proofs',
  'stock-proofs',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. profiles: Personel profil fotoğrafları
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles',
  'profiles',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: Authenticated kullanıcılar yükleyebilir, herkes okuyabilir (public bucket)
DROP POLICY IF EXISTS "stock_proofs_upload" ON storage.objects;
CREATE POLICY "stock_proofs_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stock-proofs');

DROP POLICY IF EXISTS "stock_proofs_read" ON storage.objects;
CREATE POLICY "stock_proofs_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'stock-proofs');

DROP POLICY IF EXISTS "profiles_upload" ON storage.objects;
CREATE POLICY "profiles_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profiles');

DROP POLICY IF EXISTS "profiles_read" ON storage.objects;
CREATE POLICY "profiles_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'profiles');
