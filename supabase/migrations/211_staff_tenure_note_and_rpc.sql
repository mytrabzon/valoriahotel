-- Admin'in kıdem metnini yönetebilmesi için personel tablosuna alan ekler.
-- Profil RPC'sine kıdem notunu dahil eder.

ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS tenure_note TEXT;

DROP FUNCTION IF EXISTS public.get_staff_public_profile(uuid);
CREATE OR REPLACE FUNCTION public.get_staff_public_profile(p_staff_id UUID)
RETURNS TABLE(
  id UUID,
  created_at TIMESTAMPTZ,
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
  tenure_note TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    s.id,
    s.created_at,
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
    s.tenure_note
  FROM public.staff s
  WHERE s.id = p_staff_id
    AND s.is_active = true;
$$;
