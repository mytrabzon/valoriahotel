-- upsert:true veya tekrarlayan yollar UPDATE ister; birçok bucket’ta yalnızca INSERT vardı.
-- Tüm public uygulama bucket’ları için basit UPDATE (bucket_id eşleşmesi).

BEGIN;

DROP POLICY IF EXISTS "stock_proofs_update" ON storage.objects;
CREATE POLICY "stock_proofs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'stock-proofs')
  WITH CHECK (bucket_id = 'stock-proofs');

DROP POLICY IF EXISTS "profiles_update" ON storage.objects;
CREATE POLICY "profiles_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profiles')
  WITH CHECK (bucket_id = 'profiles');

DROP POLICY IF EXISTS "feed_media_update" ON storage.objects;
CREATE POLICY "feed_media_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'feed-media')
  WITH CHECK (bucket_id = 'feed-media');

DROP POLICY IF EXISTS "message_media_update" ON storage.objects;
CREATE POLICY "message_media_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'message-media')
  WITH CHECK (bucket_id = 'message-media');

DROP POLICY IF EXISTS "contract_media_update" ON storage.objects;
CREATE POLICY "contract_media_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'contract-media')
  WITH CHECK (bucket_id = 'contract-media');

DROP POLICY IF EXISTS "staff_task_media_update" ON storage.objects;
CREATE POLICY "staff_task_media_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'staff-task-media')
  WITH CHECK (bucket_id = 'staff-task-media');

COMMIT;
