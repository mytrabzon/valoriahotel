-- İletişim bilgilerinin tüm kullanıcılarda (anon/authenticated) görünmesi için
-- RPC sonucuna profile_contact JSONB ekleniyor; client bu alanı öncelikli kullanır.
-- Bazı ortamlarda anon ile phone/email/whatsapp sütunları filtrelenebildiği için
-- iletişim verisi tek bir JSONB içinde de dönüyor.
-- Return type değiştiği için önce DROP gerekir (42P13).

DROP FUNCTION IF EXISTS public.get_staff_public_profile(UUID);

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
  shift_id UUID,
  profile_contact JSONB
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
    s.shift_id,
    jsonb_build_object(
      'phone', s.phone,
      'email', s.email,
      'whatsapp', s.whatsapp,
      'show_phone_to_guest', s.show_phone_to_guest,
      'show_email_to_guest', s.show_email_to_guest,
      'show_whatsapp_to_guest', s.show_whatsapp_to_guest
    ) AS profile_contact
  FROM public.staff s
  WHERE s.id = p_staff_id
    AND s.is_active = true;
$$;

COMMENT ON FUNCTION public.get_staff_public_profile(UUID) IS
  'Profil ziyaretlerinde çalışan bilgilerini döndürür; phone/email/whatsapp ve profile_contact ile tüm rollerde iletişim butonları görünür.';

GRANT EXECUTE ON FUNCTION public.get_staff_public_profile(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_staff_public_profile(UUID) TO authenticated;
