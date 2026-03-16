-- Valoria Hotel - Aşama 2 & 3: Çalışan profili, otel bilgisi, stok yönetimi

-- ========== AŞAMA 2: Çalışan & Otel ==========

-- Departmanlar
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vardiyalar
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  start_time TIME,
  end_time TIME,
  department_id UUID REFERENCES public.departments(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Staff tablosuna yeni sütunlar (Aşama 2)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id);
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS position TEXT;

-- Çalışan değerlendirmeleri
CREATE TABLE IF NOT EXISTS public.staff_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Otel bilgisi (tek satır, admin düzenler)
CREATE TABLE IF NOT EXISTS public.hotel_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Valoria Hotel',
  address TEXT,
  description TEXT,
  stars INTEGER DEFAULT 5 CHECK (stars >= 1 AND stars <= 5),
  cover_image TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Otel galerisi
CREATE TABLE IF NOT EXISTS public.hotel_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tesisler
CREATE TABLE IF NOT EXISTS public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bildirimler (stok onayı vb.)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========== AŞAMA 3: Stok ==========

-- Tedarikçiler (opsiyonel)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stok kategorileri
CREATE TABLE IF NOT EXISTS public.stock_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stok ürünleri
CREATE TABLE IF NOT EXISTS public.stock_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.stock_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  barcode TEXT UNIQUE,
  unit TEXT DEFAULT 'adet',
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER,
  current_stock INTEGER DEFAULT 0,
  image_url TEXT,
  purchase_price NUMERIC(10,2),
  selling_price NUMERIC(10,2),
  supplier_id UUID REFERENCES public.suppliers(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.staff(id)
);

-- Stok hareketleri (giriş/çıkış, onaylı veya bekliyor)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.stock_products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  staff_id UUID REFERENCES public.staff(id),
  staff_image TEXT,
  approved_by UUID REFERENCES public.staff(id),
  approved_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  photo_proof TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stok sayımı
CREATE TABLE IF NOT EXISTS public.stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.stock_products(id),
  counted_by UUID REFERENCES public.staff(id),
  counted_quantity INTEGER NOT NULL,
  system_quantity INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  approved_by UUID REFERENCES public.staff(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stok uyarıları
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.stock_products(id),
  alert_type TEXT NOT NULL,
  message TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES public.staff(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Depolar
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  manager_id UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_online ON public.staff(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_staff_reviews_staff ON public.staff_reviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_notifications_staff ON public.notifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON public.stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_resolved ON public.stock_alerts(is_resolved) WHERE is_resolved = false;

-- RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Politikalar: Müşteri (anon) sadece okuma: hotel_info, hotel_gallery, facilities, staff (public profil), departments, shifts
CREATE POLICY "departments_read_all" ON public.departments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "departments_staff_all" ON public.departments FOR ALL TO authenticated USING (true);

CREATE POLICY "shifts_read_all" ON public.shifts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "shifts_staff_all" ON public.shifts FOR ALL TO authenticated USING (true);

CREATE POLICY "staff_reviews_read" ON public.staff_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff_reviews_insert_anon" ON public.staff_reviews FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "staff_reviews_staff_all" ON public.staff_reviews FOR ALL TO authenticated USING (true);

CREATE POLICY "hotel_info_read" ON public.hotel_info FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "hotel_info_staff_all" ON public.hotel_info FOR ALL TO authenticated USING (true);

CREATE POLICY "hotel_gallery_read" ON public.hotel_gallery FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "hotel_gallery_staff_all" ON public.hotel_gallery FOR ALL TO authenticated USING (true);

CREATE POLICY "facilities_read" ON public.facilities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "facilities_staff_all" ON public.facilities FOR ALL TO authenticated USING (true);

CREATE POLICY "notifications_own" ON public.notifications FOR ALL USING (staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid()));

-- Stok: sadece authenticated staff
CREATE POLICY "stock_categories_all" ON public.stock_categories FOR ALL TO authenticated USING (true);
CREATE POLICY "stock_products_all" ON public.stock_products FOR ALL TO authenticated USING (true);
CREATE POLICY "stock_movements_all" ON public.stock_movements FOR ALL TO authenticated USING (true);
CREATE POLICY "stock_counts_all" ON public.stock_counts FOR ALL TO authenticated USING (true);
CREATE POLICY "stock_alerts_all" ON public.stock_alerts FOR ALL TO authenticated USING (true);
CREATE POLICY "suppliers_all" ON public.suppliers FOR ALL TO authenticated USING (true);
CREATE POLICY "warehouses_all" ON public.warehouses FOR ALL TO authenticated USING (true);

-- Not: Supabase Dashboard > Storage'dan 'profiles' ve 'stock-proofs' bucket'larını oluşturun (public).

-- Seed: hotel_info tek satır
INSERT INTO public.hotel_info (name, description, stars)
SELECT 'Valoria Hotel', 'Lüks konaklama deneyimi. Misafirlerimize en iyi hizmeti sunuyoruz.', 5
WHERE NOT EXISTS (SELECT 1 FROM public.hotel_info LIMIT 1);

-- Seed: örnek departmanlar
INSERT INTO public.departments (name, icon) VALUES
  ('Resepsiyon', '🏨'),
  ('Housekeeping', '🛏️'),
  ('Teknik', '🔧'),
  ('Güvenlik', '🛡️')
ON CONFLICT (name) DO NOTHING;
