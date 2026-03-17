-- Misafir uygulamasında "Yeni sohbet" için personel listesi (anon RLS nedeniyle staff tablosuna doğrudan SELECT yok)
CREATE OR REPLACE FUNCTION public.messaging_list_staff_for_guest()
RETURNS TABLE(
  id UUID,
  full_name TEXT,
  department TEXT,
  profile_image TEXT,
  is_online BOOLEAN,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.full_name, s.department, s.profile_image, s.is_online, s.role
  FROM public.staff s
  WHERE s.is_active = true
  ORDER BY s.full_name;
END;
$$;
