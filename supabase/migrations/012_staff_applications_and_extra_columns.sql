-- Valoria Hotel - Çalışan başvuruları (Yöntem 2) ve staff ek alanları
-- Yöntem 1: Admin panelden tam form ile ekler
-- Yöntem 2: Çalışan kendi başvurur, admin onaylar/düzenler

-- ========== STAFF EK KOLONLAR ==========
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2);
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS sgk_no TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS personnel_no TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS app_permissions JSONB DEFAULT '{}';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS work_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5];
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS shift_type TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.staff.app_permissions IS 'stok_giris, mesajlasma, video_paylasim, ekip_sohbet, gorev_ata, personel_ekle, raporlar: boolean';
COMMENT ON COLUMN public.staff.work_days IS '1=Pzt .. 7=Paz';
COMMENT ON COLUMN public.staff.shift_type IS 'morning, evening, night, flexible';

-- ========== ÇALIŞAN BAŞVURULARI (Yöntem 2) ==========
CREATE TABLE IF NOT EXISTS public.staff_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  applied_department TEXT NOT NULL,
  experience TEXT,
  profile_image_url TEXT,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Onay sırasında admin tarafından doldurulacak (veya başvurudan kopyalanacak)
  approved_position TEXT,
  approved_personnel_no TEXT,
  approved_department TEXT,
  approved_role TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_applications_status ON public.staff_applications(status);
CREATE INDEX IF NOT EXISTS idx_staff_applications_created ON public.staff_applications(created_at DESC);

ALTER TABLE public.staff_applications ENABLE ROW LEVEL SECURITY;

-- Herkes (anon) başvuru ekleyebilir
DROP POLICY IF EXISTS "staff_applications_insert_anon" ON public.staff_applications;
CREATE POLICY "staff_applications_insert_anon" ON public.staff_applications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Sadece authenticated (admin) listeleyebilir ve güncelleyebilir
DROP POLICY IF EXISTS "staff_applications_staff_select" ON public.staff_applications;
CREATE POLICY "staff_applications_staff_select" ON public.staff_applications
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_applications_staff_update" ON public.staff_applications;
CREATE POLICY "staff_applications_staff_update" ON public.staff_applications
  FOR UPDATE TO authenticated USING (true);

-- Admin tüm personeli listeleyebilsin (panel için)
DROP POLICY IF EXISTS "staff_admin_select_all" ON public.staff;
CREATE POLICY "staff_admin_select_all" ON public.staff FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  );

-- Staff ekleme/güncelleme sadece kendi satırı (staff_own) veya Edge Function (service role) ile.
-- Admin çalışan eklemek için Edge Function create-staff / approve-staff-application kullanılacak.
