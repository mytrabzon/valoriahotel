-- 146'daki foldername koşulları bazı Storage sürümlerinde/path biçimlerinde sürekli red üretebiliyor.
-- Fiş bucket için en basit güvenilir kural: giriş yapmış kullanıcı bu bucket'a yazabilsin (bucket izolasyonu).

BEGIN;

DROP POLICY IF EXISTS "expense_receipts_upload" ON storage.objects;
CREATE POLICY "expense_receipts_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "expense_receipts_update" ON storage.objects;
CREATE POLICY "expense_receipts_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-receipts')
  WITH CHECK (bucket_id = 'expense-receipts');

COMMIT;
