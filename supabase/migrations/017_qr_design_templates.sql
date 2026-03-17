-- QR tasarım şablonları ve aktif ayarlar (admin tasarım seçenekleri)
-- Oda QR ve yuvarlak avatar QR için 15-20 şablon, logo aç/kapa, arka plan/ön plan renk, şekil

CREATE TABLE IF NOT EXISTS public.qr_design_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('room', 'avatar')),
  use_logo BOOLEAN NOT NULL DEFAULT true,
  background_color TEXT NOT NULL DEFAULT '#FFFFFF',
  foreground_color TEXT NOT NULL DEFAULT '#000000',
  shape TEXT NOT NULL DEFAULT 'square' CHECK (shape IN ('square', 'rounded', 'dots', 'circle')),
  logo_size_ratio NUMERIC(3,2) DEFAULT 0.25 CHECK (logo_size_ratio >= 0 AND logo_size_ratio <= 0.5),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, category)
);

CREATE TABLE IF NOT EXISTS public.qr_design_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL UNIQUE CHECK (scope IN ('room', 'avatar')),
  template_id UUID REFERENCES public.qr_design_templates(id) ON DELETE SET NULL,
  use_logo_override BOOLEAN,
  background_color_override TEXT,
  foreground_color_override TEXT,
  shape_override TEXT CHECK (shape_override IN ('square', 'rounded', 'dots', 'circle')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_design_templates_category ON public.qr_design_templates(category);
CREATE INDEX IF NOT EXISTS idx_qr_design_templates_sort ON public.qr_design_templates(category, sort_order);

ALTER TABLE public.qr_design_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_design_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qr_design_templates_all" ON public.qr_design_templates;
CREATE POLICY "qr_design_templates_all" ON public.qr_design_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "qr_design_templates_read_anon" ON public.qr_design_templates;
CREATE POLICY "qr_design_templates_read_anon" ON public.qr_design_templates FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "qr_design_settings_all" ON public.qr_design_settings;
CREATE POLICY "qr_design_settings_all" ON public.qr_design_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "qr_design_settings_read_anon" ON public.qr_design_settings;
CREATE POLICY "qr_design_settings_read_anon" ON public.qr_design_settings FOR SELECT TO anon USING (true);

-- Varsayılan şablonlar: 10 oda + 10 avatar (toplam 20)
INSERT INTO public.qr_design_templates (name, category, use_logo, background_color, foreground_color, shape, logo_size_ratio, sort_order) VALUES
-- Oda QR şablonları (room)
('Klasik Siyah-Beyaz', 'room', true, '#FFFFFF', '#000000', 'square', 0.22, 1),
('Klasik Logo Yok', 'room', false, '#FFFFFF', '#000000', 'square', 0.25, 2),
('Valoria Altın', 'room', true, '#FFFFFF', '#B8860B', 'square', 0.24, 3),
('Koyu Tema', 'room', true, '#1a365d', '#FFFFFF', 'square', 0.22, 4),
('Yuvarlatılmış Köşe', 'room', true, '#F7FAFC', '#2D3748', 'rounded', 0.23, 5),
('Lüks Lacivert', 'room', true, '#2C5282', '#E2E8F0', 'rounded', 0.22, 6),
('Nötr Gri', 'room', false, '#E2E8F0', '#1A202C', 'square', 0.25, 7),
('Yeşil Doğa', 'room', true, '#F0FFF4', '#276749', 'rounded', 0.24, 8),
('Turuncu Enerji', 'room', true, '#FFFAF0', '#C05621', 'square', 0.22, 9),
('Minimal Beyaz', 'room', false, '#FFFFFF', '#4A5568', 'rounded', 0.25, 10),
('Bordo Şık', 'room', true, '#742A2A', '#FED7D7', 'square', 0.22, 11),
('Açık Mavi', 'room', true, '#EBF8FF', '#2B6CB0', 'rounded', 0.23, 12),
-- Yuvarlak avatar QR şablonları (avatar)
('Avatar Klasik', 'avatar', true, '#FFFFFF', '#000000', 'circle', 0.20, 1),
('Avatar Logo Yok', 'avatar', false, '#FFFFFF', '#000000', 'circle', 0.22, 2),
('Avatar Altın', 'avatar', true, '#FFFAF0', '#B8860B', 'circle', 0.20, 3),
('Avatar Koyu', 'avatar', true, '#1a365d', '#FFFFFF', 'circle', 0.18, 4),
('Avatar Yuvarlak Nokta', 'avatar', true, '#F7FAFC', '#2D3748', 'dots', 0.20, 5),
('Avatar Lacivert', 'avatar', true, '#2C5282', '#E2E8F0', 'circle', 0.19, 6),
('Avatar Gri', 'avatar', false, '#E2E8F0', '#1A202C', 'circle', 0.22, 7),
('Avatar Yeşil', 'avatar', true, '#F0FFF4', '#276749', 'circle', 0.20, 8),
('Avatar Turuncu', 'avatar', true, '#FFFAF0', '#C05621', 'circle', 0.19, 9),
('Avatar Minimal', 'avatar', false, '#FFFFFF', '#4A5568', 'rounded', 0.22, 10),
('Avatar Bordo', 'avatar', true, '#742A2A', '#FED7D7', 'circle', 0.18, 11),
('Avatar Mavi', 'avatar', true, '#EBF8FF', '#2B6CB0', 'circle', 0.20, 12)
ON CONFLICT (name, category) DO NOTHING;

-- Aktif ayar kayıtları (scope başına bir satır)
INSERT INTO public.qr_design_settings (scope, template_id)
SELECT 'room', id FROM public.qr_design_templates WHERE category = 'room' ORDER BY sort_order LIMIT 1
ON CONFLICT (scope) DO NOTHING;
INSERT INTO public.qr_design_settings (scope, template_id)
SELECT 'avatar', id FROM public.qr_design_templates WHERE category = 'avatar' ORDER BY sort_order LIMIT 1
ON CONFLICT (scope) DO NOTHING;
