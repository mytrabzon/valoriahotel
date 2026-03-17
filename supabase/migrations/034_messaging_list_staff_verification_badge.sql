-- Personel listesinde doğrulama rozetini de döndür (misafir yeni sohbet ekranı)
-- Dönüş tipi değiştiği için önce DROP, sonra CREATE gerekir (PostgreSQL mevcut fonksiyon imzasını REPLACE ile değiştirmez).
DROP FUNCTION IF EXISTS public.messaging_list_staff_for_guest();

CREATE FUNCTION public.messaging_list_staff_for_guest()
RETURNS TABLE(
  id UUID,
  full_name TEXT,
  department TEXT,
  profile_image TEXT,
  is_online BOOLEAN,
  role TEXT,
  verification_badge TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.full_name, s.department, s.profile_image, s.is_online, s.role, s.verification_badge
  FROM public.staff s
  WHERE s.is_active = true
  ORDER BY s.full_name;
END;
$$;
