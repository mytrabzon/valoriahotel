-- Misafir bildirimleri: hafif özet (liste çekmeden yeni var mı) + tek seferde tümünü okundu işaretle
CREATE OR REPLACE FUNCTION public.get_guest_notification_summary(p_app_token TEXT)
RETURNS TABLE(latest_created_at timestamptz, unread_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id uuid;
BEGIN
  SELECT id INTO v_guest_id FROM public.guests WHERE app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    (SELECT max(n.created_at) FROM public.notifications n WHERE n.guest_id = v_guest_id),
    (SELECT count(*)::bigint FROM public.notifications n WHERE n.guest_id = v_guest_id AND n.read_at IS NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_guest_notifications_read(p_app_token TEXT)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id uuid;
  n int;
BEGIN
  SELECT id INTO v_guest_id FROM public.guests WHERE app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.notifications
  SET read_at = now()
  WHERE guest_id = v_guest_id AND read_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_notification_summary(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mark_all_guest_notifications_read(TEXT) TO authenticated, anon, service_role;
