-- HMB (Hazine ve Maliye Bakanlığı) Günlük Müşteri Listesi raporu - VUK Md. 240
-- Konaklama kayıtlarına vergi/ücret alanları; rapor geçmişi tablosu

-- Misafir kayıtlarına vergi ve hasılat alanları (konaklama başına)
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS total_amount_net DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS accommodation_tax_amount DECIMAL(12,2);

COMMENT ON COLUMN public.guests.total_amount_net IS 'Konaklama bedeli KDV hariç (oda başı veya misafir payı)';
COMMENT ON COLUMN public.guests.vat_amount IS 'KDV tutarı (%10)';
COMMENT ON COLUMN public.guests.accommodation_tax_amount IS 'Konaklama vergisi tutarı (%2)';

-- HMB rapor kayıtları (hazırlanan PDF'lerin meta verisi)
CREATE TABLE IF NOT EXISTS public.hmb_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number VARCHAR(50) UNIQUE,
  report_type VARCHAR(20) DEFAULT 'custom' CHECK (report_type IN ('daily', 'monthly', 'quarterly', 'yearly', 'custom')),

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  room_filter JSONB,
  guest_filter JSONB,

  total_stays INTEGER,
  total_guests INTEGER,
  total_nights INTEGER,
  total_revenue_net DECIMAL(12,2),
  total_vat DECIMAL(12,2),
  total_accommodation_tax DECIMAL(12,2),

  pdf_url TEXT,
  pdf_size INTEGER,

  created_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hmb_reports_created ON public.hmb_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hmb_reports_dates ON public.hmb_reports(start_date, end_date);

ALTER TABLE public.hmb_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hmb_reports_authenticated" ON public.hmb_reports;
CREATE POLICY "hmb_reports_authenticated" ON public.hmb_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
