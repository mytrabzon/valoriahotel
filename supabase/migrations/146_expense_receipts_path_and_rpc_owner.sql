-- Fiş storage: yaygın şablon politikaları ilk path segmentinin auth.uid() olmasını bekler.
-- Eski yol receipts/{staff_id}/... bu yüzden RLS'e takılabiliyordu (staff.id ≠ auth.users.id).
-- INSERT/UPDATE: bucket + (ilk klasör = oturum uid VEYA geçici olarak legacy "receipts" kökü).

BEGIN;

DROP POLICY IF EXISTS "expense_receipts_upload" ON storage.objects;
CREATE POLICY "expense_receipts_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[1] = 'receipts'
    )
  );

DROP POLICY IF EXISTS "expense_receipts_update" ON storage.objects;
CREATE POLICY "expense_receipts_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[1] = 'receipts'
    )
  )
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[1] = 'receipts'
    )
  );

-- Mümkünse fonksiyon sahibi postgres olsun (RLS ile ilgili edge case). Yetki yoksa atlanır.
DO $owner$
BEGIN
  ALTER FUNCTION public.insert_my_staff_expense(uuid, date, time, numeric, text, text, text, text[]) OWNER TO postgres;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'insert_my_staff_expense OWNER TO postgres atlandı: %', SQLERRM;
END;
$owner$;

COMMIT;
