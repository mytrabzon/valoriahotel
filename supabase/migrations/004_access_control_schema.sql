-- Migration: Access control (doors, cards, permissions)
-- Valoria Hotel - Kartli Gecis Sistemi

-- ========== KAPILAR ==========
-- Oda kapıları (room_id dolu) + ortak alanlar (otopark, havuz, spor, personel)
CREATE TABLE IF NOT EXISTS public.doors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  door_type TEXT NOT NULL CHECK (door_type IN ('room', 'parking', 'pool', 'gym', 'staff', 'storage', 'other')),
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Oda kapıları için room_id ile otomatik isim (opsiyonel); name zaten "Oda 102" gibi tutulabilir
CREATE UNIQUE INDEX IF NOT EXISTS idx_doors_room ON public.doors(room_id) WHERE room_id IS NOT NULL;

-- ========== ERİŞİM KARTLARI ==========
-- Fiziksel RFID/NFC veya dijital anahtar (telefon) için tek tablo
-- serial_number: fiziksel kart okutulunca gelen seri (örn. 97-76-67-9); dijital için token/uid
CREATE TABLE IF NOT EXISTS public.access_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT NOT NULL UNIQUE,
  card_type TEXT NOT NULL CHECK (card_type IN ('guest', 'vip_guest', 'housekeeping', 'technical', 'security', 'manager', 'temporary')),
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  all_doors BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.staff(id)
);

-- Kart hangi kapıları açabilir (all_doors=true ise bu satırlar yok sayılır / tüm kapılar kabul)
CREATE TABLE IF NOT EXISTS public.card_door_permissions (
  card_id UUID NOT NULL REFERENCES public.access_cards(id) ON DELETE CASCADE,
  door_id UUID NOT NULL REFERENCES public.doors(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, door_id)
);

-- ========== PERSONEL KAPI YETKİLERİ (Zamanlı) ==========
-- Hangi personel hangi kapıyı hangi saat/gün açabilir
CREATE TABLE IF NOT EXISTS public.staff_door_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  door_id UUID NOT NULL REFERENCES public.doors(id) ON DELETE CASCADE,
  time_start TIME,
  time_end TIME,
  days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7],
  valid_from DATE DEFAULT current_date,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, door_id)
);

-- ========== KAPI AÇILMA LOGLARI ==========
CREATE TABLE IF NOT EXISTS public.door_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  door_id UUID NOT NULL REFERENCES public.doors(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.access_cards(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  serial_used TEXT,
  result TEXT NOT NULL CHECK (result IN ('granted', 'denied')),
  denial_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========== İNDEXLER ==========
CREATE INDEX IF NOT EXISTS idx_doors_type ON public.doors(door_type);
CREATE INDEX IF NOT EXISTS idx_doors_active ON public.doors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_access_cards_serial ON public.access_cards(serial_number);
CREATE INDEX IF NOT EXISTS idx_access_cards_guest ON public.access_cards(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_cards_staff ON public.access_cards(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_cards_active ON public.access_cards(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_access_cards_valid ON public.access_cards(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_card_door_permissions_card ON public.card_door_permissions(card_id);
CREATE INDEX IF NOT EXISTS idx_staff_door_permissions_staff ON public.staff_door_permissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_door_access_logs_door ON public.door_access_logs(door_id);
CREATE INDEX IF NOT EXISTS idx_door_access_logs_created ON public.door_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_door_access_logs_result ON public.door_access_logs(result);

-- ========== RLS ==========
ALTER TABLE public.doors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_door_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_door_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.door_access_logs ENABLE ROW LEVEL SECURITY;

-- Sadece authenticated (admin/resepsiyon) yönetir
DROP POLICY IF EXISTS "doors_staff_all" ON public.doors;
CREATE POLICY "doors_staff_all" ON public.doors FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "access_cards_staff_all" ON public.access_cards;
CREATE POLICY "access_cards_staff_all" ON public.access_cards FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "card_door_permissions_staff_all" ON public.card_door_permissions;
CREATE POLICY "card_door_permissions_staff_all" ON public.card_door_permissions FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "staff_door_permissions_staff_all" ON public.staff_door_permissions;
CREATE POLICY "staff_door_permissions_staff_all" ON public.staff_door_permissions FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "door_access_logs_staff_all" ON public.door_access_logs;
CREATE POLICY "door_access_logs_staff_all" ON public.door_access_logs FOR ALL TO authenticated USING (true);

-- Misafir (anon) sadece kendi dijital anahtarını görebilir / API ile kapı açma isteği yapabilir (ayrı endpoint)
-- Burada anon read yok; dijital anahtar kontrolü Edge Function veya service role ile yapılır.

-- ========== SEED: Varsayılan kapılar (ortak alanlar) ==========
INSERT INTO public.doors (name, door_type, sort_order)
SELECT * FROM (VALUES
  ('Otopark Girişi', 'parking'::TEXT, 100),
  ('Havuz', 'pool'::TEXT, 101),
  ('Spor Salonu', 'gym'::TEXT, 102),
  ('Personel Girişi', 'staff'::TEXT, 103)
) AS v(name, door_type, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.doors WHERE door_type = 'parking' LIMIT 1);

-- Not: Oda kapıları admin panelden "Oda 101", "Oda 102" ... olarak rooms tablosuna göre eklenebilir.
