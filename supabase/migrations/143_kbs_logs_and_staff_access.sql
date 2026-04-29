-- KBS izleme logları + personel KBS sekmesi erişimi (admin aç/kapa)
BEGIN;

ALTER TABLE ops.app_users
  ADD COLUMN IF NOT EXISTS kbs_access_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN ops.app_users.kbs_access_enabled IS 'Admin tarafından kapatılırsa personel KBS ekranları gizlenir.';

CREATE TABLE IF NOT EXISTS ops.kbs_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES ops.hotels(id) ON DELETE RESTRICT,
  transaction_id uuid REFERENCES ops.official_submission_transactions(id) ON DELETE SET NULL,
  guest_document_id uuid,
  request_payload jsonb,
  response_payload jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_kbs_logs_hotel_created_idx ON ops.kbs_logs(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_kbs_logs_tx_idx ON ops.kbs_logs(transaction_id);

ALTER TABLE ops.kbs_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ops_kbs_logs_select" ON ops.kbs_logs;
CREATE POLICY "ops_kbs_logs_select" ON ops.kbs_logs
  FOR SELECT TO authenticated
  USING (hotel_id = ops.current_hotel_id() AND ops.has_permission('kbs.view.transactions'));

DROP POLICY IF EXISTS "ops_kbs_logs_insert" ON ops.kbs_logs;
CREATE POLICY "ops_kbs_logs_insert" ON ops.kbs_logs
  FOR INSERT TO authenticated
  WITH CHECK (hotel_id = ops.current_hotel_id());

COMMIT;
