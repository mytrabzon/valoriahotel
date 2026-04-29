-- KBS pipeline izleme: resmi işlem satırında açık KBS alanları (UI / admin rozetleri)
BEGIN;

ALTER TABLE ops.official_submission_transactions
  ADD COLUMN IF NOT EXISTS kbs_status text,
  ADD COLUMN IF NOT EXISTS kbs_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS kbs_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS kbs_error_code text,
  ADD COLUMN IF NOT EXISTS kbs_error_message text,
  ADD COLUMN IF NOT EXISTS kbs_response_payload jsonb;

COMMENT ON COLUMN ops.official_submission_transactions.kbs_status IS 'KBS gönderim durumu: pending | success | failed (Edge/VPS orchestration).';
COMMENT ON COLUMN ops.official_submission_transactions.kbs_last_attempt_at IS 'Son KBS / gateway denemesi zamanı.';
COMMENT ON COLUMN ops.official_submission_transactions.kbs_sent_at IS 'KBS tarafına başarılı iletim zamanı.';
COMMENT ON COLUMN ops.official_submission_transactions.kbs_error_code IS 'Son hata kodu (ör. GATEWAY, GATEWAY_TIMEOUT).';
COMMENT ON COLUMN ops.official_submission_transactions.kbs_error_message IS 'Son hata metni.';
COMMENT ON COLUMN ops.official_submission_transactions.kbs_response_payload IS 'KBS/gateway yanıt özeti (JSON).';

COMMIT;
