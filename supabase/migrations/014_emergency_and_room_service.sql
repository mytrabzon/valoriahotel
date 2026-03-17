-- Valoria Hotel - Acil durum bildirimi RPC + Oda servisi (dijital menü / sipariş)

-- ========== 1. Acil durum: Admin'lere bildirim gönder ==========
CREATE OR REPLACE FUNCTION public.create_emergency_alert(
  p_guest_id UUID,
  p_room_number TEXT DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff RECORD;
  v_count INTEGER := 0;
  v_title TEXT := '🆘 Acil durum';
  v_body TEXT;
BEGIN
  v_body := 'Misafir acil yardım istiyor.';
  IF p_guest_name IS NOT NULL AND p_guest_name != '' THEN
    v_body := v_body || ' Misafir: ' || p_guest_name;
  END IF;
  IF p_room_number IS NOT NULL AND p_room_number != '' THEN
    v_body := v_body || ' Oda: ' || p_room_number;
  END IF;

  FOR v_staff IN SELECT id FROM public.staff WHERE is_active = true AND role = 'admin'
  LOOP
    INSERT INTO public.notifications (staff_id, title, body, category, notification_type)
    VALUES (v_staff.id, v_title, v_body, 'emergency', 'panic');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.create_emergency_alert IS 'Misafir panik butonu: tüm admin hesaplarına acil bildirim gönderir.';

-- ========== 2. Oda servisi: Kategoriler ==========
CREATE TABLE IF NOT EXISTS public.room_service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========== 3. Oda servisi: Menü ürünleri ==========
CREATE TABLE IF NOT EXISTS public.room_service_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.room_service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_service_menu_category ON public.room_service_menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_room_service_menu_available ON public.room_service_menu_items(is_available) WHERE is_available = true;

-- ========== 4. Oda servisi: Siparişler ==========
CREATE TABLE IF NOT EXISTS public.room_service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled')),
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_service_orders_guest ON public.room_service_orders(guest_id);
CREATE INDEX IF NOT EXISTS idx_room_service_orders_status ON public.room_service_orders(status);

-- ========== 5. Oda servisi: Sipariş kalemleri ==========
CREATE TABLE IF NOT EXISTS public.room_service_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.room_service_orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.room_service_menu_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity >= 1) DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_service_order_items_order ON public.room_service_order_items(order_id);

-- RLS
ALTER TABLE public.room_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_service_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_service_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_service_categories_read" ON public.room_service_categories;
CREATE POLICY "room_service_categories_read" ON public.room_service_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "room_service_menu_read" ON public.room_service_menu_items;
CREATE POLICY "room_service_menu_read" ON public.room_service_menu_items FOR SELECT USING (true);

-- Sipariş: misafir kendi siparişini okuyabilsin (guest_id ile eşleşecek RPC veya app'te email->guest_id)
DROP POLICY IF EXISTS "room_service_orders_select" ON public.room_service_orders;
CREATE POLICY "room_service_orders_select" ON public.room_service_orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "room_service_orders_insert" ON public.room_service_orders;
CREATE POLICY "room_service_orders_insert" ON public.room_service_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "room_service_orders_update" ON public.room_service_orders;
CREATE POLICY "room_service_orders_update" ON public.room_service_orders FOR UPDATE USING (true);

DROP POLICY IF EXISTS "room_service_order_items_select" ON public.room_service_order_items;
CREATE POLICY "room_service_order_items_select" ON public.room_service_order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "room_service_order_items_insert" ON public.room_service_order_items;
CREATE POLICY "room_service_order_items_insert" ON public.room_service_order_items FOR INSERT TO authenticated WITH CHECK (true);

-- Seed: Örnek kategoriler
INSERT INTO public.room_service_categories (name, sort_order)
SELECT v.name, v.sort_order
FROM (VALUES ('Kahvaltı', 1), ('Öğle / Akşam', 2), ('İçecekler', 3), ('Atıştırmalık', 4)) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.room_service_categories LIMIT 1);

-- Seed: Örnek menü (category id'yi alıp ekleyeceğiz - basit için name ile)
DO $$
DECLARE
  v_kat UUID;
  v_icecek UUID;
BEGIN
  SELECT id INTO v_kat FROM public.room_service_categories WHERE name = 'Kahvaltı' LIMIT 1;
  IF v_kat IS NOT NULL THEN
    INSERT INTO public.room_service_menu_items (category_id, name, description, price, sort_order)
    SELECT v_kat, 'Serpme Kahvaltı', 'Zeytin, peynir, reçel, bal, yumurta, söğüş', 250.00, 1
    WHERE NOT EXISTS (SELECT 1 FROM public.room_service_menu_items WHERE name = 'Serpme Kahvaltı' LIMIT 1);
    INSERT INTO public.room_service_menu_items (category_id, name, description, price, sort_order)
    VALUES (v_kat, 'Menemen', 'Domates, biber, yumurta', 120.00, 2),
           (v_kat, 'Omlet', 'Sade veya peynirli', 95.00, 3);
  END IF;
  SELECT id INTO v_icecek FROM public.room_service_categories WHERE name = 'İçecekler' LIMIT 1;
  IF v_icecek IS NOT NULL THEN
    INSERT INTO public.room_service_menu_items (category_id, name, description, price, sort_order)
    VALUES (v_icecek, 'Türk Kahvesi', 'Orta şekerli', 45.00, 1),
           (v_icecek, 'Çay', 'Demlik', 25.00, 2),
           (v_icecek, 'Meyve Suyu', 'Portakal / Elma', 55.00, 3);
  END IF;
END $$;

COMMENT ON TABLE public.room_service_orders IS 'Oda servisi siparişleri (dijital menü).';
COMMENT ON TABLE public.room_service_menu_items IS 'Oda servisi menü ürünleri.';
