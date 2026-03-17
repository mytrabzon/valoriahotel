-- Valoria Hotel - Profil görünürlük ve ek alanlar (müşteri/çalışan/admin matrisi)
-- Müşteri: telefon/e-posta/whatsapp ayarlanabilir; çalışan (başkası) bu alanları görmez.

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS office_location TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS achievements TEXT[] DEFAULT '{}';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
-- Müşteriye göster: true = herkese açık, false = sadece kendi ve admin görür
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS show_phone_to_guest BOOLEAN DEFAULT true;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS show_email_to_guest BOOLEAN DEFAULT true;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS show_whatsapp_to_guest BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.staff.office_location IS 'Ofis/konum (örn: 2. Kat Ofisi)';
COMMENT ON COLUMN public.staff.achievements IS 'Başarılar/ödüller (örn: Ayın Personeli 2024)';
COMMENT ON COLUMN public.staff.show_phone_to_guest IS 'Müşteri profil sayfasında telefon gösterilsin mi';
COMMENT ON COLUMN public.staff.show_email_to_guest IS 'Müşteri profil sayfasında e-posta gösterilsin mi';
COMMENT ON COLUMN public.staff.show_whatsapp_to_guest IS 'Müşteri profil sayfasında WhatsApp gösterilsin mi';
