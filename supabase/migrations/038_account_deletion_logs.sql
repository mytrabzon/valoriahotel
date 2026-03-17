-- KVKK/GDPR uyumlu hesap silme logları (10 yıl saklama)
CREATE TABLE IF NOT EXISTS public.account_deletion_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('guest', 'staff')),
  user_email VARCHAR(255),
  user_phone VARCHAR(50),
  deleted_by VARCHAR(20) NOT NULL CHECK (deleted_by IN ('user', 'admin', 'automatic')),
  deleted_by_admin_id UUID REFERENCES public.staff(id),
  deletion_reason TEXT,
  admin_reason TEXT,
  account_age_days INTEGER,
  total_stays INTEGER,
  total_reviews INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.account_deletion_logs IS 'KVKK gereği hesap silme logları - 10 yıl saklanmalıdır';

-- Sadece admin ve service role okuyabilsin
ALTER TABLE public.account_deletion_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_deletion_logs_admin" ON public.account_deletion_logs;
CREATE POLICY "account_deletion_logs_admin" ON public.account_deletion_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid() AND s.role = 'admin' AND s.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid() AND s.role = 'admin' AND s.is_active = true
    )
  );

-- Service role (Edge Functions) her şeyi yapabilsin
-- RLS bypass for service_role is default in Supabase
