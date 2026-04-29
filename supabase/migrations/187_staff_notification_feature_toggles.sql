-- Personel bildirim tercihleri: özellik bazlı kapat/aç
-- Mesaj ve admin duyuru bildirimleri her zaman açık kalır.

CREATE OR REPLACE FUNCTION public.filter_staff_notification_recipients(
  p_staff_ids uuid[],
  p_notification_type text
)
RETURNS TABLE(staff_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := lower(coalesce(trim(p_notification_type), ''));
BEGIN
  IF p_staff_ids IS NULL OR array_length(p_staff_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Zorunlu bildirimler: mesajlar ve admin duyuruları kapatılamaz.
  IF v_type IN ('message', 'admin_announcement') THEN
    RETURN QUERY
    SELECT s.id
    FROM public.staff s
    WHERE s.id = ANY (p_staff_ids);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id
  FROM public.staff s
  LEFT JOIN public.notification_preferences np
    ON np.staff_id = s.id
   AND np.pref_key = 'staff_notif_' || v_type
  WHERE s.id = ANY (p_staff_ids)
    AND coalesce(np.enabled, true);
END;
$$;

REVOKE ALL ON FUNCTION public.filter_staff_notification_recipients(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.filter_staff_notification_recipients(uuid[], text) TO authenticated;

COMMENT ON FUNCTION public.filter_staff_notification_recipients(uuid[], text) IS
'Personel alıcı listesini notification_preferences (staff_notif_<type>) tercihine göre filtreler; message/admin_announcement daima açıktır.';
