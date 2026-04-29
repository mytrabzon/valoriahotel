-- Kim MRZ kaydetti (profil & audit) + yeni satırların Realtime ile yayınlanması
ALTER TABLE ops.guest_documents
  ADD COLUMN IF NOT EXISTS scanned_by_user_id uuid;

COMMENT ON COLUMN ops.guest_documents.scanned_by_user_id IS 'MRZ kaydını tamamlayan personelin auth user id (auth.users)';

-- Supabase Realtime: INSERT ile diğer yetkili personel listeleri güncelleyebilsin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'ops'
      AND tablename = 'guest_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ops.guest_documents;
  END IF;
END $$;
