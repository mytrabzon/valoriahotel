-- Misafir kayıt formu: doğum tarihi, cinsiyet, adres, oda tipi, yetişkin/çocuk sayısı (tek sayfa sözleşme onayı için)
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS room_type TEXT;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 1;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS children INTEGER DEFAULT 0;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS phone_country_code TEXT DEFAULT '+90';
COMMENT ON COLUMN public.guests.phone_country_code IS 'WhatsApp/telefon ülke kodu (+90, +1 vb.)';
