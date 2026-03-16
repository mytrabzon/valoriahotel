-- Valoria Hotel - Bildirim Sistemi (Notifications)
-- Admin / Personel / Misafir bildirimleri, şablonlar, tercihler, toplu gönderim

-- ========== 1. Mevcut notifications tablosunu genişlet ==========
-- staff_id artık nullable (misafir bildirimleri için); guest_id eklenir
ALTER TABLE public.notifications
  ALTER COLUMN staff_id DROP NOT NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS notification_type TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('emergency', 'guest', 'staff', 'admin', 'bulk')),
  ADD COLUMN IF NOT EXISTS sent_via TEXT DEFAULT 'in_app' CHECK (sent_via IN ('in_app', 'push', 'both')),
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;

-- Constraint: en az biri dolu olmalı
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_recipient_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_recipient_check CHECK (
    (guest_id IS NOT NULL AND staff_id IS NULL) OR
    (staff_id IS NOT NULL AND guest_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_notifications_guest ON public.notifications(guest_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);

-- Misafir uygulaması için güvenli erişim: guests tablosuna app_token
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS app_token TEXT UNIQUE;

-- Yeni misafir kaydında otomatik app_token atama
CREATE OR REPLACE FUNCTION public.set_guest_app_token_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.app_token IS NULL THEN
    NEW.app_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guest_app_token ON public.guests;
CREATE TRIGGER trg_guest_app_token
  BEFORE INSERT ON public.guests
  FOR EACH ROW EXECUTE PROCEDURE public.set_guest_app_token_on_insert();

-- ========== 2. Bildirim şablonları ==========
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_audience TEXT NOT NULL CHECK (target_audience IN ('guest', 'staff')),
  template_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('info', 'warning', 'campaign', 'event', 'reminder', 'meeting', 'urgent')),
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(target_audience, template_key)
);

-- ========== 3. Bildirim tercihleri (misafir / personel) ==========
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  pref_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT prefs_recipient_check CHECK (
    (guest_id IS NOT NULL AND staff_id IS NULL) OR
    (staff_id IS NOT NULL AND guest_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_prefs_guest_key
  ON public.notification_preferences(guest_id, pref_key) WHERE guest_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_prefs_staff_key
  ON public.notification_preferences(staff_id, pref_key) WHERE staff_id IS NOT NULL;

-- ========== 4. Push tokenları (Expo Push) ==========
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT push_recipient_check CHECK (
    (guest_id IS NOT NULL AND staff_id IS NULL) OR
    (staff_id IS NOT NULL AND guest_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_guest ON public.push_tokens(guest_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_staff ON public.push_tokens(staff_id);

-- ========== RLS ==========
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Şablonlar: herkes okuyabilsin, sadece staff yazabilsin
DROP POLICY IF EXISTS "notification_templates_read" ON public.notification_templates;
CREATE POLICY "notification_templates_read" ON public.notification_templates
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "notification_templates_staff" ON public.notification_templates;
CREATE POLICY "notification_templates_staff" ON public.notification_templates
  FOR ALL TO authenticated USING (true);

-- Tercihler: kendi kaydına erişim (staff: auth; guest: RPC ile)
DROP POLICY IF EXISTS "notification_preferences_staff" ON public.notification_preferences;
CREATE POLICY "notification_preferences_staff" ON public.notification_preferences
  FOR ALL USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );
-- Guest tercihleri RPC veya anon ile token üzerinden güncellenebilir (ayrı RPC)

-- Push tokenlar: kendi tokenını ekleyebilsin
DROP POLICY IF EXISTS "push_tokens_staff" ON public.push_tokens;
CREATE POLICY "push_tokens_staff" ON public.push_tokens
  FOR ALL USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

-- Notifications: mevcut policy düzelt (staff_id = auth.uid() yanlış; staff.id <> auth.uid())
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_staff_own" ON public.notifications;
CREATE POLICY "notifications_staff_own" ON public.notifications
  FOR ALL USING (
    staff_id IS NOT NULL AND staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );
-- Misafir bildirimleri RPC ile okunacak (app_token ile)
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notifications_select_admin" ON public.notifications;
CREATE POLICY "notifications_select_admin" ON public.notifications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- ========== RPC: Misafir bildirimlerini token ile getir ==========
CREATE OR REPLACE FUNCTION public.get_guest_notifications(p_app_token TEXT)
RETURNS SETOF public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
BEGIN
  SELECT id INTO v_guest_id FROM public.guests WHERE app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT n.* FROM public.notifications n
  WHERE n.guest_id = v_guest_id
  ORDER BY n.created_at DESC
  LIMIT 100;
END;
$$;

-- RPC: Misafir bildirimini okundu işaretle
CREATE OR REPLACE FUNCTION public.mark_guest_notification_read(p_app_token TEXT, p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
BEGIN
  SELECT id INTO v_guest_id FROM public.guests WHERE app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN RETURN false; END IF;
  UPDATE public.notifications SET read_at = now() WHERE id = p_notification_id AND guest_id = v_guest_id;
  RETURN FOUND;
END;
$$;

-- RPC: Misafir tercihlerini getir / güncelle (token ile)
CREATE OR REPLACE FUNCTION public.get_guest_notification_preferences(p_app_token TEXT)
RETURNS TABLE(pref_key TEXT, enabled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
BEGIN
  SELECT id INTO v_guest_id FROM public.guests WHERE app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT np.pref_key, np.enabled FROM public.notification_preferences np WHERE np.guest_id = v_guest_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_guest_notification_preference(p_app_token TEXT, p_pref_key TEXT, p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
BEGIN
  SELECT id INTO v_guest_id FROM public.guests WHERE app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.notification_preferences WHERE guest_id = v_guest_id AND pref_key = p_pref_key;
  INSERT INTO public.notification_preferences (guest_id, pref_key, enabled) VALUES (v_guest_id, p_pref_key, p_enabled);
END;
$$;

-- Misafir app_token atama (sadece staff/admin veya sistem tarafından; check-in sonrası çağrılabilir)
CREATE OR REPLACE FUNCTION public.set_guest_app_token(p_guest_id UUID, p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.guests SET app_token = p_token WHERE id = p_guest_id;
END;
$$;

-- Misafir doğrulama kodu ile app_token al (sadece doğrulama yapılmış ise)
CREATE OR REPLACE FUNCTION public.get_guest_app_token_after_verify(p_guest_id UUID, p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.verification_codes WHERE guest_id = p_guest_id AND code = p_code AND used_at IS NOT NULL) THEN
    RETURN NULL;
  END IF;
  SELECT app_token INTO v_token FROM public.guests WHERE id = p_guest_id;
  RETURN v_token;
END;
$$;

-- ========== Seed: Hazır bildirim şablonları ==========
INSERT INTO public.notification_templates (target_audience, template_key, category, title_template, body_template, is_system, sort_order) VALUES
-- Misafir
('guest', 'breakfast_hours', 'info', 'Kahvaltı Saatleri', '☕ Kahvaltı 07:00-10:00 arası restorandadır.', true, 1),
('guest', 'wifi_password', 'info', 'WiFi Şifresi', '📶 WiFi şifreniz: valoria{{room_number}} (Oda numaranız)', true, 2),
('guest', 'quiet_hours', 'warning', 'Sessizlik Saati', '🌙 Sessizlik saatleri 23:00-09:00 arasıdır.', true, 3),
('guest', 'no_smoking', 'warning', 'Sigara Yasağı', '🚭 Odalarda sigara içmek yasaktır.', true, 4),
('guest', 'spa_discount', 'campaign', 'Spa İndirimi', '💆 Spa''da bugün %20 indirim var!', true, 5),
('guest', 'late_checkout', 'campaign', 'Geç Çıkış', '⏰ Geç çıkış yapmak ister misiniz? 150 TL ek ücretle 15:00''e kadar', true, 6),
('guest', 'live_music', 'event', 'Canlı Müzik', '🎵 Bu akşam 21:00''de lobide canlı müzik var!', true, 7),
('guest', 'checkout_reminder', 'reminder', 'Çıkış Saati', '⏰ Çıkış saatiniz 11:00, odanızı hazırlayın.', true, 8),
-- Personel
('staff', 'morning_meeting', 'meeting', 'Sabah Toplantısı', '🗣️ Sabah toplantısı 09:00''da resepsiyonda.', true, 1),
('staff', 'uniform', 'warning', 'Kılık Kıyafet', '👔 Üniforma zorunludur. Lütfen dikkat!', true, 2),
('staff', 'shift_change', 'info', 'Vardiya Değişimi', '🔄 Akşam vardiyasına geçenler: Ahmet, Mehmet, Ayşe', true, 3),
('staff', 'staff_needed', 'urgent', 'Personel İhtiyacı', '🆕 Bugün ek personel gerekiyor. Müsait olan var mı?', true, 4)
ON CONFLICT (target_audience, template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  updated_at = now();
