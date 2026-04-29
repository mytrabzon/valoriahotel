-- Acil durum RPC: misafir dilinde durum metni (p_situation) eklendi
DROP FUNCTION IF EXISTS public.create_emergency_alert(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_emergency_alert(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_emergency_alert(
  p_guest_id UUID,
  p_room_number TEXT DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL,
  p_situation TEXT DEFAULT NULL
)
RETURNS TABLE(staff_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff RECORD;
  v_title TEXT := '🆘 Acil durum';
  v_body TEXT;
BEGIN
  v_body := 'Misafir acil yardım istiyor.';
  IF p_situation IS NOT NULL AND btrim(p_situation) <> '' THEN
    v_body := v_body || ' Durum: ' || p_situation;
  END IF;
  IF p_guest_name IS NOT NULL AND p_guest_name != '' THEN
    v_body := v_body || ' Misafir: ' || p_guest_name;
  END IF;
  IF p_room_number IS NOT NULL AND p_room_number != '' THEN
    v_body := v_body || ' Oda: ' || p_room_number;
  END IF;

  FOR v_staff IN SELECT id FROM public.staff WHERE is_active = true AND role = 'admin'
  LOOP
    INSERT INTO public.notifications (staff_id, title, body, category, notification_type)
    VALUES (v_staff.id, v_title, v_body, 'emergency', 'panic');
    staff_id := v_staff.id;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.create_emergency_alert IS 'Misafir panik butonu: tüm admin hesaplarına acil bildirim yazar ve bildirim gönderilen staff_id listesini döndürür (push için). p_situation: isteğe bağlı durum açıklaması.';
