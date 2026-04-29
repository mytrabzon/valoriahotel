-- Fiş bucket: upsert:true ikinci ve sonraki yüklemeler storage.objects üzerinde UPDATE tetikler.
-- Sadece INSERT politikası vardı; güncelleme RLS yüzünden reddediliyordu.

DROP POLICY IF EXISTS "expense_receipts_update" ON storage.objects;
CREATE POLICY "expense_receipts_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-receipts')
  WITH CHECK (bucket_id = 'expense-receipts');
