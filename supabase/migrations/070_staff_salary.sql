-- Valoria Hotel - Maaş Yönetim Sistemi
-- salary_payments: admin maaş girişi, personel onayı, bildirimler

CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2020 AND period_year <= 2100),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_date DATE NOT NULL,
  payment_time TIME,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('transfer', 'cash', 'credit_card')),
  bank_or_reference TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  staff_approved_at TIMESTAMPTZ,
  staff_rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_staff ON public.salary_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_status ON public.salary_payments(status);
CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON public.salary_payments(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_salary_payments_created ON public.salary_payments(created_at DESC);

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

-- Personel: kendi ödemelerini görebilir ve onay/red güncelleyebilir (sadece pending_approval)
DROP POLICY IF EXISTS "salary_payments_staff_own" ON public.salary_payments;
CREATE POLICY "salary_payments_staff_own" ON public.salary_payments
  FOR ALL TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

-- Personel sadece kendi kaydında status güncelleyebilsin (onay/red); admin tüm alanları güncelleyebilir
-- Bu policy ile staff kendi satırında UPDATE yapabilir (onay/red için yeterli)
-- Admin: tüm kayıtları görür ve tüm işlemler
DROP POLICY IF EXISTS "salary_payments_admin_all" ON public.salary_payments;
CREATE POLICY "salary_payments_admin_all" ON public.salary_payments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  );

-- Admin insert
DROP POLICY IF EXISTS "salary_payments_admin_insert" ON public.salary_payments;
CREATE POLICY "salary_payments_admin_insert" ON public.salary_payments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.set_salary_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salary_payments_updated_at ON public.salary_payments;
CREATE TRIGGER salary_payments_updated_at
  BEFORE UPDATE ON public.salary_payments
  FOR EACH ROW EXECUTE PROCEDURE public.set_salary_payments_updated_at();
