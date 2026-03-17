-- Valoria Hotel - Personel Harcama Takip Sistemi
-- expense_categories, staff_expenses, storage bucket, RLS

-- 1. Harcama kategorileri
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Personel harcamaları
CREATE TABLE IF NOT EXISTS public.staff_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL,
  expense_time TIME,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'credit_card', 'company_card')),
  description TEXT,
  receipt_image_url TEXT,
  tags TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_expenses_staff ON public.staff_expenses(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_expenses_category ON public.staff_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_staff_expenses_status ON public.staff_expenses(status);
CREATE INDEX IF NOT EXISTS idx_staff_expenses_date ON public.staff_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_staff_expenses_created ON public.staff_expenses(created_at);

-- Varsayılan kategoriler (tablo boşsa ekle)
INSERT INTO public.expense_categories (name, description, icon, sort_order)
SELECT v.name, v.description, v.icon, v.sort_order
FROM (VALUES
  ('Teknik Malzeme', 'Klima, elektrik, tamir malzemeleri', 'construct', 1),
  ('Temizlik Malzemesi', 'Deterjan, çöp poşeti, bez vb.', 'brush', 2),
  ('Ofis Malzemesi', 'Kırtasiye, kağıt, toner', 'document-text', 3),
  ('Yakıt', 'Araç yakıtı', 'car', 4),
  ('Yemek / İkram', 'Yemek, ikram, toplantı', 'restaurant', 5),
  ('Ulaşım', 'Toplu taşıma, taksi', 'bus', 6),
  ('Diğer', 'Diğer harcamalar', 'ellipsis-horizontal', 7)
) AS v(name, description, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories LIMIT 1);

-- 3. Storage bucket: fiş fotoğrafları
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "expense_receipts_upload" ON storage.objects;
CREATE POLICY "expense_receipts_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-receipts');

DROP POLICY IF EXISTS "expense_receipts_read" ON storage.objects;
CREATE POLICY "expense_receipts_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'expense-receipts');

-- 4. RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_expenses ENABLE ROW LEVEL SECURITY;

-- Kategoriler: herkes (authenticated) okuyabilir
DROP POLICY IF EXISTS "expense_categories_select" ON public.expense_categories;
CREATE POLICY "expense_categories_select" ON public.expense_categories
  FOR SELECT TO authenticated USING (is_active = true);

-- Admin kategorileri düzenleyebilir (opsiyonel, ileride)
DROP POLICY IF EXISTS "expense_categories_admin" ON public.expense_categories;
CREATE POLICY "expense_categories_admin" ON public.expense_categories
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  );

-- Personel: kendi harcamalarını görebilir ve ekleyebilir
DROP POLICY IF EXISTS "staff_expenses_own_select" ON public.staff_expenses;
CREATE POLICY "staff_expenses_own_select" ON public.staff_expenses
  FOR SELECT TO authenticated USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "staff_expenses_own_insert" ON public.staff_expenses;
CREATE POLICY "staff_expenses_own_insert" ON public.staff_expenses
  FOR INSERT TO authenticated WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

-- Personel kendi kaydını sadece pending iken silebilir (opsiyonel)
DROP POLICY IF EXISTS "staff_expenses_own_delete" ON public.staff_expenses;
CREATE POLICY "staff_expenses_own_delete" ON public.staff_expenses
  FOR DELETE TO authenticated USING (
    status = 'pending' AND staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

-- Admin: tüm harcamaları görür, onaylar, günceller
DROP POLICY IF EXISTS "staff_expenses_admin_all" ON public.staff_expenses;
CREATE POLICY "staff_expenses_admin_all" ON public.staff_expenses
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  );

-- Admin insert (manuel harcama ekleme)
DROP POLICY IF EXISTS "staff_expenses_admin_insert" ON public.staff_expenses;
CREATE POLICY "staff_expenses_admin_insert" ON public.staff_expenses
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_staff_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_expenses_updated_at ON public.staff_expenses;
CREATE TRIGGER staff_expenses_updated_at
  BEFORE UPDATE ON public.staff_expenses
  FOR EACH ROW EXECUTE PROCEDURE public.set_staff_expenses_updated_at();
