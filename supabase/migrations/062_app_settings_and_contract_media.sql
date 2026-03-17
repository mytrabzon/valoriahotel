-- Uygulama ayarları: QR base URL'leri, mağaza linkleri (admin panelden düzenlenir)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Varsayılan anahtarlar (boş/null = env/uygulama varsayılanı kullanılır)
INSERT INTO public.app_settings (key, value) VALUES
  ('google_play_url', NULL),
  ('app_store_url', NULL),
  ('contract_qr_base_url', NULL),
  ('checkin_qr_base_url', NULL)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_authenticated" ON public.app_settings;
CREATE POLICY "app_settings_authenticated" ON public.app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage: sözleşme içeriğinde kullanılacak resimler
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-media',
  'contract-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "contract_media_upload" ON storage.objects;
CREATE POLICY "contract_media_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-media');

DROP POLICY IF EXISTS "contract_media_read" ON storage.objects;
CREATE POLICY "contract_media_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'contract-media');
