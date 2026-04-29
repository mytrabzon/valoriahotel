-- Uygulama ikonu rozeti: push (Expo) payload'daki badge = okunmamış bildirim + okunmamış mesaj
-- (mesaj tablosu, notifications dışı). Service role (Edge) çağırır.

-- Misafir: messaging_list_conversations_guest ile aynı unread mantığı, guest_id ile
CREATE OR REPLACE FUNCTION public.messaging_unread_count_guest(p_guest_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum bigint := 0;
  r record;
  v_cnt bigint;
BEGIN
  FOR r IN
    SELECT c.id AS conv_id
    FROM public.conversations c
    INNER JOIN public.conversation_participants gcp
      ON gcp.conversation_id = c.id
      AND gcp.participant_id = p_guest_id
      AND gcp.participant_type = 'guest'
      AND gcp.left_at IS NULL
  LOOP
    SELECT COUNT(*)::bigint INTO v_cnt
    FROM public.messages m
    INNER JOIN public.conversation_participants cp
      ON cp.conversation_id = m.conversation_id
      AND cp.participant_id = p_guest_id
      AND cp.participant_type = 'guest'
      AND cp.left_at IS NULL
    WHERE m.conversation_id = r.conv_id
      AND m.sender_id <> p_guest_id
      AND m.sender_type <> 'guest'
      AND NOT m.is_deleted
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at);
    v_sum := v_sum + COALESCE(v_cnt, 0);
  END LOOP;
  RETURN v_sum;
END;
$$;

-- Personel: staffListConversations (messagingApi) ile aynı okunmamış mantığı
CREATE OR REPLACE FUNCTION public.messaging_unread_count_staff(p_staff_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::bigint
    FROM public.messages m
    INNER JOIN public.conversation_participants cp
      ON cp.conversation_id = m.conversation_id
      AND cp.participant_id = p_staff_id
      AND cp.participant_type IN ('staff', 'admin')
      AND cp.left_at IS NULL
    WHERE m.is_deleted = false
      AND m.created_at >= (SELECT s.created_at FROM public.staff s WHERE s.id = p_staff_id)
      AND NOT (m.sender_id = p_staff_id AND m.sender_type IN ('staff', 'admin'))
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.app_badge_total_for_guest(p_guest_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(999, GREATEST(0,
    COALESCE((
      SELECT count(*)::integer FROM public.notifications
      WHERE guest_id = p_guest_id AND read_at IS NULL
    ), 0) + COALESCE(public.messaging_unread_count_guest(p_guest_id), 0)::integer
  ))::integer;
$$;

CREATE OR REPLACE FUNCTION public.app_badge_total_for_staff(p_staff_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(999, GREATEST(0,
    COALESCE((
      SELECT count(*)::integer FROM public.notifications
      WHERE staff_id = p_staff_id AND read_at IS NULL
    ), 0) + COALESCE(public.messaging_unread_count_staff(p_staff_id), 0)::integer
  ))::integer;
$$;

REVOKE ALL ON FUNCTION public.messaging_unread_count_guest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.messaging_unread_count_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_badge_total_for_guest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_badge_total_for_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.messaging_unread_count_guest(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.messaging_unread_count_staff(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_badge_total_for_guest(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_badge_total_for_staff(uuid) TO service_role;

COMMENT ON FUNCTION public.app_badge_total_for_staff(uuid) IS
  'Push / simge: okunmamış notifications + sohbet mesajları (in-app list ile aynı toplam).';
COMMENT ON FUNCTION public.app_badge_total_for_guest(uuid) IS
  'Push / simge: okunmamış notifications + sohbet mesajları.';
