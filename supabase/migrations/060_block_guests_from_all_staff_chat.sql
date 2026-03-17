-- Prevent guests from seeing / joining the "Tüm Çalışanlar" staff group chat.

-- 1) Cleanup: if any guest was mistakenly added, remove them.
DELETE FROM public.conversation_participants cp
USING public.conversations c
WHERE cp.conversation_id = c.id
  AND c.type = 'group'
  AND c.name = 'Tüm Çalışanlar'
  AND cp.participant_type = 'guest';

-- 2) DB-level guard: block inserting/updating guest participants into that conversation.
CREATE OR REPLACE FUNCTION public.prevent_guest_in_all_staff_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.participant_type = 'guest'
     AND EXISTS (
       SELECT 1
       FROM public.conversations c
       WHERE c.id = NEW.conversation_id
         AND c.type = 'group'
         AND c.name = 'Tüm Çalışanlar'
     )
  THEN
    RAISE EXCEPTION 'Guests cannot join the all-staff conversation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_guest_in_all_staff_conversation ON public.conversation_participants;
CREATE TRIGGER trg_prevent_guest_in_all_staff_conversation
  BEFORE INSERT OR UPDATE OF conversation_id, participant_type ON public.conversation_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_guest_in_all_staff_conversation();

-- 3) Extra safety in guest RPCs: exclude the conversation even if legacy data exists.

CREATE OR REPLACE FUNCTION public.messaging_list_conversations_guest(p_app_token TEXT)
RETURNS TABLE(
  id UUID,
  type VARCHAR(20),
  name VARCHAR(255),
  avatar TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
BEGIN
  SELECT g.id INTO v_guest_id FROM public.guests g WHERE g.app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.type,
    c.name,
    c.avatar,
    c.last_message_at,
    (SELECT m.content FROM public.messages m WHERE m.id = c.last_message_id AND m.message_type = 'text' AND NOT m.is_deleted LIMIT 1),
    (SELECT COUNT(*)::BIGINT
     FROM public.messages m
     JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.participant_id = v_guest_id AND cp.participant_type = 'guest' AND cp.left_at IS NULL
     WHERE m.conversation_id = c.id AND m.sender_id <> v_guest_id AND m.sender_type <> 'guest'
       AND NOT m.is_deleted
       AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at))
  FROM public.conversations c
  JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.participant_id = v_guest_id AND cp.participant_type = 'guest' AND cp.left_at IS NULL
  WHERE NOT (c.type = 'group' AND c.name = 'Tüm Çalışanlar')
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.messaging_get_messages_guest(
  p_app_token TEXT,
  p_conversation_id UUID,
  p_limit INT DEFAULT 50,
  p_before_id UUID DEFAULT NULL
)
RETURNS SETOF public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
BEGIN
  SELECT g.id INTO v_guest_id FROM public.guests g WHERE g.app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN RETURN; END IF;

  -- Block access to the all-staff conversation even if legacy participant rows exist.
  IF EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = p_conversation_id AND c.type = 'group' AND c.name = 'Tüm Çalışanlar') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id
      AND participant_id = v_guest_id
      AND participant_type = 'guest'
      AND left_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.* FROM public.messages m
  WHERE m.conversation_id = p_conversation_id AND NOT m.is_deleted
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;

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
  v_msg_id UUID;
BEGIN
  SELECT g.id, g.full_name INTO v_guest_id, v_guest_name FROM public.guests g WHERE g.app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN RETURN NULL; END IF;

  -- Block sending to the all-staff conversation.
  IF EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = p_conversation_id AND c.type = 'group' AND c.name = 'Tüm Çalışanlar') THEN
    RETURN NULL;
  END IF;

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

  INSERT INTO public.messages (conversation_id, sender_id, sender_type, sender_name, message_type, content, media_url)
  VALUES (
    p_conversation_id,
    v_guest_id,
    'guest',
    v_guest_name,
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

