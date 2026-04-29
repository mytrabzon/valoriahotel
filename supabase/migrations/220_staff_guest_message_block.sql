BEGIN;

-- Misafir tarafindan yeni sohbet baslatmada personel izin kontrolu.
CREATE OR REPLACE FUNCTION public.messaging_guest_get_or_create_with_staff(p_app_token TEXT, p_staff_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
  v_staff_accepts_guest_messages BOOLEAN;
BEGIN
  SELECT g.id INTO v_guest_id FROM public.guests g WHERE g.app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE((s.app_permissions->>'misafir_mesaj_alabilir')::boolean, true)
  INTO v_staff_accepts_guest_messages
  FROM public.staff s
  WHERE s.id = p_staff_id
    AND s.is_active = true
    AND s.deleted_at IS NULL
  LIMIT 1;

  IF COALESCE(v_staff_accepts_guest_messages, false) = false THEN
    RETURN NULL;
  END IF;

  RETURN public.messaging_get_or_create_direct(v_guest_id, 'guest', p_staff_id, 'staff');
END;
$$;

-- Misafir listesinde yalnizca mesaj alimi acik personelleri goster.
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
    AND s.deleted_at IS NULL
    AND COALESCE((s.app_permissions->>'misafir_mesaj_alabilir')::boolean, true) = true
  ORDER BY s.full_name;
END;
$$;

COMMENT ON FUNCTION public.messaging_list_staff_for_guest() IS
  'Misafir yeni sohbet: silinmeyen ve misafirden mesaj almaya acik personel listesi.';

GRANT EXECUTE ON FUNCTION public.messaging_list_staff_for_guest() TO anon;
GRANT EXECUTE ON FUNCTION public.messaging_list_staff_for_guest() TO authenticated;

-- Mevcut sohbette de personel kapatmissa misafir mesaj gonderemesin.
CREATE OR REPLACE FUNCTION public.messaging_send_message_guest(
  p_app_token TEXT,
  p_conversation_id UUID,
  p_content TEXT,
  p_message_type VARCHAR DEFAULT 'text',
  p_media_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
  v_guest_name TEXT;
  v_guest_email TEXT;
  v_guest_photo TEXT;
  v_display_name TEXT;
  v_msg_id UUID;
BEGIN
  SELECT g.id, g.full_name, g.email, g.photo_url
  INTO v_guest_id, v_guest_name, v_guest_email, v_guest_photo
  FROM public.guests g
  WHERE g.app_token = p_app_token
  LIMIT 1;

  IF v_guest_id IS NULL THEN RETURN NULL; END IF;
  v_display_name := COALESCE(NULLIF(TRIM(v_guest_name), ''), NULLIF(TRIM(v_guest_email), ''), 'Misafir');

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND participant_id = v_guest_id
      AND participant_type = 'guest'
      AND left_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    JOIN public.staff s
      ON s.id = cp.participant_id
     AND cp.participant_type IN ('staff', 'admin')
    WHERE cp.conversation_id = p_conversation_id
      AND cp.left_at IS NULL
      AND COALESCE((s.app_permissions->>'misafir_mesaj_alabilir')::boolean, true) = false
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, sender_type, sender_name, sender_avatar, message_type, content, media_url)
  VALUES (
    p_conversation_id,
    v_guest_id,
    'guest',
    v_display_name,
    NULLIF(TRIM(v_guest_photo), ''),
    COALESCE(NULLIF(p_message_type, ''), 'text'),
    p_content,
    NULLIF(p_media_url, '')
  )
  RETURNING id INTO v_msg_id;

  UPDATE public.conversations
  SET last_message_id = v_msg_id, last_message_at = now(), updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_msg_id;
END;
$$;

COMMIT;
