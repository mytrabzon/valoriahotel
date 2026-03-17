-- Barkod formatı alanı (opsiyonel; ean13, code128, qr vb.)
ALTER TABLE public.stock_products
  ADD COLUMN IF NOT EXISTS barcode_format VARCHAR(20);

-- Barkod okuma geçmişi (raporlama ve sık kullanılanlar için)
CREATE TABLE IF NOT EXISTS public.barcode_scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode VARCHAR(100) NOT NULL,
  barcode_type VARCHAR(20),
  product_id UUID REFERENCES public.stock_products(id),
  scanned_by UUID REFERENCES public.staff(id),
  scan_result VARCHAR(20) NOT NULL DEFAULT 'found' CHECK (scan_result IN ('found', 'not_found')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_barcode_scan_history_scanned_by ON public.barcode_scan_history(scanned_by);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_history_created_at ON public.barcode_scan_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_history_barcode ON public.barcode_scan_history(barcode);

ALTER TABLE public.barcode_scan_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "barcode_scan_history_authenticated" ON public.barcode_scan_history;
CREATE POLICY "barcode_scan_history_authenticated" ON public.barcode_scan_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
