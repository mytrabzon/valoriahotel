-- Mesajlaşma için OTP/check-in şartı kaldırıldı: dileyen giriş kodu ile mesajlaşabilir.
-- 1) Misafir app_token'ı guest_id ile al (OTP olmadan)
-- 2) Mesajlaşma kimliği sadece geçerli app_token istesin; check_in zorunlu olmasın

CREATE OR REPLACE FUNCTION public.get_guest_app_token(p_guest_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT app_token INTO v_token FROM public.guests WHERE id = p_guest_id LIMIT 1;
  RETURN v_token;
END;
$$;

-- Mesajlaşma: check_in şartı yok; geçerli app_token yeterli
CREATE OR REPLACE FUNCTION public.get_guest_messaging_identity(p_app_token TEXT)
RETURNS TABLE(guest_id UUID, full_name TEXT, room_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.full_name, r.room_number
  FROM public.guests g
  LEFT JOIN public.rooms r ON r.id = g.room_id
  WHERE g.app_token = p_app_token
  LIMIT 1;
END;
$$;
