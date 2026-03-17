-- Çalışan profil ziyaretlerinde telefon ve e-posta görünsün.
-- RLS ile doğrudan staff SELECT bazen rol/session nedeniyle bu sütunları
-- döndürmeyebilir; tek kaynak olarak SECURITY DEFINER RPC kullanıyoruz.
-- Sadece is_active ve id ile tek satır döner; phone/email/whatsapp
-- show_*_to_guest bayraklarına göre aynen tablodan gelir.

CREATE OR REPLACE FUNCTION public.get_staff_public_profile(p_staff_id UUID)
RETURNS TABLE(
  id UUID,
  full_name TEXT,
  department TEXT,
  "position" TEXT,
  profile_image TEXT,
  cover_image TEXT,
  bio TEXT,
  is_online BOOLEAN,
  hire_date DATE,
  average_rating NUMERIC,
  total_reviews INTEGER,
  specialties TEXT[],
  languages TEXT[],
  office_location TEXT,
  achievements TEXT[],
  show_phone_to_guest BOOLEAN,
  show_email_to_guest BOOLEAN,
  show_whatsapp_to_guest BOOLEAN,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  verification_badge TEXT,
  shift_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    s.id,
    s.full_name,
    s.department,
    s.position,
    s.profile_image,
    s.cover_image,
    s.bio,
    s.is_online,
    s.hire_date,
    s.average_rating,
    s.total_reviews,
    s.specialties,
    s.languages,
    s.office_location,
    s.achievements,
    s.show_phone_to_guest,
    s.show_email_to_guest,
    s.show_whatsapp_to_guest,
    s.phone,
    s.email,
    s.whatsapp,
    s.verification_badge,
    s.shift_id
  FROM public.staff s
  WHERE s.id = p_staff_id
    AND s.is_active = true;
$$;

COMMENT ON FUNCTION public.get_staff_public_profile(UUID) IS
  'Profil ziyaretlerinde (müşteri/personel) çalışan bilgilerini döndürür; telefon/e-posta show_*_to_guest ile birlikte gelir. RLS bypass.';

GRANT EXECUTE ON FUNCTION public.get_staff_public_profile(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_staff_public_profile(UUID) TO authenticated;
