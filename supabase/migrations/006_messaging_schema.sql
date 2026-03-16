-- Valoria Hotel - Realtime Mesajlaşma Sistemi
-- Conversations, messages, typing, online status, announcements

-- ========== 1. Guests / Staff sütunları (mevcut yapıya uyumlu) ==========
-- Staff: 002'de is_online, last_active var; last_seen ve typing_status ekliyoruz
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS typing_status JSONB DEFAULT '{}';

-- Guests: mesajlaşma için online/last_seen/typing
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS typing_status JSONB DEFAULT '{}';

-- ========== 2. Sohbetler ==========
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group', 'department')),
  name VARCHAR(255),
  avatar TEXT,
  created_by UUID,
  created_by_type VARCHAR(20) CHECK (created_by_type IN ('guest', 'staff', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_message_id UUID,
  last_message_at TIMESTAMPTZ
);

-- ========== 3. Sohbet katılımcıları ==========
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL,
  participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('guest', 'staff', 'admin')),
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  UNIQUE(conversation_id, participant_id, participant_type)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(participant_id, participant_type);

-- ========== 4. Mesajlar ==========
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('guest', 'staff', 'admin')),
  sender_name VARCHAR(255),
  sender_avatar TEXT,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'location', 'voice')),
  content TEXT,
  media_url TEXT,
  media_thumbnail TEXT,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_name VARCHAR(255),
  is_delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  reply_to_id UUID,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS fk_messages_reply_to;
ALTER TABLE public.messages
  ADD CONSTRAINT fk_messages_reply_to
  FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(conversation_id, created_at DESC);

-- conversations.last_message_id referansı (mesajlar tablosu sonra oluşturulduğu için ayrı)
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS fk_conversations_last_message;
ALTER TABLE public.conversations
  ADD CONSTRAINT fk_conversations_last_message
  FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

-- ========== 5. Mesaj durumu (okundu / iletildi) ==========
CREATE TABLE IF NOT EXISTS public.message_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('guest', 'staff', 'admin')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('delivered', 'read')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, user_type)
);

CREATE INDEX IF NOT EXISTS idx_message_status_message ON public.message_status(message_id);

-- ========== 6. Beğeniler ==========
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('guest', 'staff', 'admin')),
  reaction VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, user_type)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);

-- ========== 7. Bloke listesi ==========
CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL,
  blocker_type VARCHAR(20) NOT NULL CHECK (blocker_type IN ('guest', 'staff', 'admin')),
  blocked_id UUID NOT NULL,
  blocked_type VARCHAR(20) NOT NULL CHECK (blocked_type IN ('guest', 'staff', 'admin')),
  reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocker_type, blocked_id, blocked_type)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id, blocker_type);

-- ========== 8. Duyurular (admin toplu mesaj) ==========
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_type VARCHAR(20) DEFAULT 'all' CHECK (target_type IN ('all', 'guests', 'staff', 'department')),
  target_department VARCHAR(50),
  target_rooms JSONB,
  image_url TEXT,
  action_url TEXT,
  action_text VARCHAR(100),
  created_by UUID NOT NULL,
  created_by_type VARCHAR(20) NOT NULL CHECK (created_by_type IN ('staff', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active) WHERE is_active = true;

-- ========== 9. Duyuru okunma ==========
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('guest', 'staff', 'admin')),
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, user_id, user_type)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_ann ON public.announcement_reads(announcement_id);

-- ========== 10. Realtime publication ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_status') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;
END $$;

-- ========== 11. RLS ==========
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Staff/Admin: auth ile tam erişim (kendi katıldığı sohbetler veya yeni oluşturma)
DROP POLICY IF EXISTS "conversations_staff" ON public.conversations;
CREATE POLICY "conversations_staff" ON public.conversations
  FOR ALL TO authenticated
  USING (
    created_by IS NULL
    OR created_by_type IN ('staff', 'admin') AND created_by IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      JOIN public.staff s ON s.id = cp.participant_id AND cp.participant_type IN ('staff', 'admin')
      WHERE cp.conversation_id = conversations.id AND s.auth_id = auth.uid()
    )
  );
CREATE POLICY "conversations_staff_insert" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (
    created_by_type IN ('staff', 'admin') AND created_by IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "conv_participants_staff" ON public.conversation_participants;
CREATE POLICY "conv_participants_staff" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    (participant_type IN ('staff', 'admin') AND participant_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_participants cp2 ON cp2.conversation_id = c.id
      JOIN public.staff s ON s.id = cp2.participant_id AND cp2.participant_type IN ('staff', 'admin')
      WHERE c.id = conversation_id AND s.auth_id = auth.uid()
    )
  );
CREATE POLICY "conv_participants_staff_insert" ON public.conversation_participants
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid())
    AND (participant_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid()) AND participant_type IN ('staff', 'admin')
         OR EXISTS (SELECT 1 FROM public.conversation_participants cp2 JOIN public.staff s ON s.id = cp2.participant_id AND cp2.participant_type IN ('staff', 'admin') WHERE cp2.conversation_id = conversation_participants.conversation_id AND s.auth_id = auth.uid()))
  );
CREATE POLICY "conv_participants_staff_update" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (participant_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid()) AND participant_type IN ('staff', 'admin'));

DROP POLICY IF EXISTS "messages_staff" ON public.messages;
CREATE POLICY "messages_staff" ON public.messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      JOIN public.staff s ON s.id = cp.participant_id AND cp.participant_type IN ('staff', 'admin')
      WHERE cp.conversation_id = messages.conversation_id AND s.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "message_status_staff" ON public.message_status;
CREATE POLICY "message_status_staff" ON public.message_status
  FOR ALL TO authenticated
  USING (
    user_type IN ('staff', 'admin') AND user_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      JOIN public.staff s ON s.id = cp.participant_id AND cp.participant_type IN ('staff', 'admin')
      WHERE m.id = message_id AND s.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "message_reactions_staff" ON public.message_reactions;
CREATE POLICY "message_reactions_staff" ON public.message_reactions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      JOIN public.staff s ON s.id = cp.participant_id AND cp.participant_type IN ('staff', 'admin')
      WHERE m.id = message_id AND s.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "blocks_staff" ON public.blocks;
CREATE POLICY "blocks_staff" ON public.blocks
  FOR ALL TO authenticated
  USING (
    blocker_type IN ('staff', 'admin') AND blocker_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR blocked_type IN ('staff', 'admin') AND blocked_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "announcements_staff_read" ON public.announcements;
CREATE POLICY "announcements_staff_read" ON public.announcements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "announcements_staff_write" ON public.announcements;
CREATE POLICY "announcements_staff_write" ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (
    created_by_type IN ('staff', 'admin') AND created_by IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );
CREATE POLICY "announcements_staff_update" ON public.announcements
  FOR UPDATE TO authenticated
  USING (created_by IN (SELECT id FROM public.staff WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "announcement_reads_staff" ON public.announcement_reads;
CREATE POLICY "announcement_reads_staff" ON public.announcement_reads
  FOR ALL TO authenticated
  USING (
    user_type IN ('staff', 'admin') AND user_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );
CREATE POLICY "announcement_reads_staff_insert" ON public.announcement_reads
  FOR INSERT TO authenticated WITH CHECK (
    user_type IN ('staff', 'admin') AND user_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

-- ========== 12. Guest erişimi: app_token ile RPC ==========
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
  WHERE g.app_token = p_app_token AND g.status = 'checked_in'
  LIMIT 1;
END;
$$;

-- Misafir sohbet listesi (app_token)
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
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$;

-- Misafir mesajları getir (app_token + conversation_id)
CREATE OR REPLACE FUNCTION public.messaging_get_messages_guest(p_app_token TEXT, p_conversation_id UUID, p_limit INT DEFAULT 50, p_before_id UUID DEFAULT NULL)
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
  IF NOT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = p_conversation_id AND participant_id = v_guest_id AND participant_type = 'guest' AND left_at IS NULL) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT m.* FROM public.messages m
  WHERE m.conversation_id = p_conversation_id AND NOT m.is_deleted
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Misafir mesaj gönder (app_token)
CREATE OR REPLACE FUNCTION public.messaging_send_message_guest(p_app_token TEXT, p_conversation_id UUID, p_content TEXT, p_message_type VARCHAR DEFAULT 'text')
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
  IF NOT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = p_conversation_id AND participant_id = v_guest_id AND participant_type = 'guest' AND left_at IS NULL) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.messages (conversation_id, sender_id, sender_type, sender_name, message_type, content)
  VALUES (p_conversation_id, v_guest_id, 'guest', v_guest_name, COALESCE(NULLIF(p_message_type, ''), 'text'), p_content)
  RETURNING id INTO v_msg_id;
  UPDATE public.conversations SET last_message_id = v_msg_id, last_message_at = now(), updated_at = now() WHERE id = p_conversation_id;
  RETURN v_msg_id;
END;
$$;

-- Misafir: app_token + staff_id ile sohbet başlat / getir
CREATE OR REPLACE FUNCTION public.messaging_guest_get_or_create_with_staff(p_app_token TEXT, p_staff_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
BEGIN
  SELECT g.id INTO v_guest_id FROM public.guests g WHERE g.app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.messaging_get_or_create_direct(v_guest_id, 'guest', p_staff_id, 'staff');
END;
$$;

-- Misafir veya personel için yeni direct sohbet başlat / mevcut sohbeti getir
CREATE OR REPLACE FUNCTION public.messaging_get_or_create_direct(
  p_actor_id UUID,
  p_actor_type VARCHAR(20),
  p_other_id UUID,
  p_other_type VARCHAR(20)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id UUID;
BEGIN
  IF p_actor_type NOT IN ('guest', 'staff', 'admin') OR p_other_type NOT IN ('guest', 'staff', 'admin') THEN
    RETURN NULL;
  END IF;
  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  WHERE c.type = 'direct'
  AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = c.id AND participant_id = p_actor_id AND participant_type = p_actor_type AND left_at IS NULL)
  AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = c.id AND participant_id = p_other_id AND participant_type = p_other_type AND left_at IS NULL)
  LIMIT 1;
  IF v_conv_id IS NOT NULL THEN RETURN v_conv_id; END IF;
  INSERT INTO public.conversations (type, created_by, created_by_type) VALUES ('direct', p_actor_id, p_actor_type) RETURNING id INTO v_conv_id;
  INSERT INTO public.conversation_participants (conversation_id, participant_id, participant_type) VALUES (v_conv_id, p_actor_id, p_actor_type);
  INSERT INTO public.conversation_participants (conversation_id, participant_id, participant_type) VALUES (v_conv_id, p_other_id, p_other_type);
  RETURN v_conv_id;
END;
$$;

-- Trigger: conversation updated_at
CREATE OR REPLACE FUNCTION public.set_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conv_updated_at ON public.conversations;
CREATE TRIGGER conv_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE PROCEDURE public.set_conversation_updated_at();
