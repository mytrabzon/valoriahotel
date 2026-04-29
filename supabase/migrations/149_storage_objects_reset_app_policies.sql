-- Uygulama Storage RLS: Dashboard / eski migration / çakışan policy yüzünden INSERT sürekli reddedilebiliyor.
-- storage.objects üzerindeki TÜM politikaları (OPS pasaport hariç) kaldırıp, mobil/web uygulama
-- bucket'ları için tek ve basit kurallarla yeniden oluşturur.
-- passport-thumbs / passport-private politikaları (ops_passport*) korunur.

BEGIN;

-- OPS dışındaki tüm storage.objects politikalarını düşür
DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname NOT LIKE 'ops_passport%'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END;
$drop$;

-- expense-receipts
CREATE POLICY "expense_receipts_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'expense-receipts');
CREATE POLICY "expense_receipts_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');
CREATE POLICY "expense_receipts_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-receipts')
  WITH CHECK (bucket_id = 'expense-receipts');

-- stock-proofs
CREATE POLICY "stock_proofs_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'stock-proofs');
CREATE POLICY "stock_proofs_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stock-proofs');
CREATE POLICY "stock_proofs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'stock-proofs')
  WITH CHECK (bucket_id = 'stock-proofs');

-- profiles (authenticated)
CREATE POLICY "profiles_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'profiles');
CREATE POLICY "profiles_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profiles');
CREATE POLICY "profiles_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profiles')
  WITH CHECK (bucket_id = 'profiles');
-- Misafir kayıt / anon avatar (path karmaşasından kaçınmak için sadece bucket)
CREATE POLICY "profiles_guest_anon_upload" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'profiles');

-- feed-media (tek INSERT politikası: staff + misafir authenticated)
CREATE POLICY "feed_media_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'feed-media');
CREATE POLICY "feed_media_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-media');
CREATE POLICY "feed_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'feed-media')
  WITH CHECK (bucket_id = 'feed-media');

-- message-media
CREATE POLICY "message_media_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'message-media');
CREATE POLICY "message_media_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-media');
CREATE POLICY "message_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'message-media')
  WITH CHECK (bucket_id = 'message-media');

-- contract-media
CREATE POLICY "contract_media_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'contract-media');
CREATE POLICY "contract_media_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-media');
CREATE POLICY "contract_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contract-media')
  WITH CHECK (bucket_id = 'contract-media');

-- staff-task-media
CREATE POLICY "staff_task_media_select" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'staff-task-media');
CREATE POLICY "staff_task_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staff-task-media');
CREATE POLICY "staff_task_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'staff-task-media')
  WITH CHECK (bucket_id = 'staff-task-media');

-- app-link-icons (yalnızca admin — admin_auth_ids)
CREATE POLICY "app_link_icons_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'app-link-icons');
CREATE POLICY "app_link_icons_upload_admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'app-link-icons'
    AND EXISTS (SELECT 1 FROM public.admin_auth_ids WHERE auth_id = auth.uid())
  );
CREATE POLICY "app_link_icons_update_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'app-link-icons'
    AND EXISTS (SELECT 1 FROM public.admin_auth_ids WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'app-link-icons'
    AND EXISTS (SELECT 1 FROM public.admin_auth_ids WHERE auth_id = auth.uid())
  );

COMMIT;
