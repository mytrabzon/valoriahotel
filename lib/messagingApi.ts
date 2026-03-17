/**
 * Valoria Hotel - Mesajlaşma API (Staff = Supabase client, Guest = RPC + app_token)
 */
import { File } from 'expo-file-system';
import { encode as encodeBase64 } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import type { MessagingActor, Message, Conversation, ConversationWithMeta } from '@/lib/messaging';

// ----- Staff (authenticated) -----

export async function staffListConversations(staffId: string): Promise<ConversationWithMeta[]> {
  const { data: participants, error: epErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at, is_pinned')
    .eq('participant_id', staffId)
    .in('participant_type', ['staff', 'admin'])
    .is('left_at', null);

  if (epErr || !participants?.length) return [];

  const convIds = participants.map((p: { conversation_id: string }) => p.conversation_id);
  const { data: convsData, error: convErr } = await supabase
    .from('conversations')
    .select('id, type, name, avatar, created_by, created_by_type, created_at, updated_at, last_message_id, last_message_at')
    .in('id', convIds);

  if (convErr || !convsData?.length) return [];

  const convs = convsData as Conversation[];
  const lastMsgIds = convs.map((c) => c.last_message_id).filter(Boolean) as string[];

  let lastMessages: { id: string; content: string | null }[] = [];
  if (lastMsgIds.length) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, content')
      .in('id', lastMsgIds);
    lastMessages = msgs ?? [];
  }

  // Direct sohbetlerde karşı tarafın adı (tek sorgu)
  const { data: allOthers } = await supabase
    .from('conversation_participants')
    .select('conversation_id, participant_id, participant_type')
    .in('conversation_id', convIds)
    .neq('participant_id', staffId)
    .is('left_at', null);
  const otherByConv = new Map<string, { id: string; type: string }>();
  for (const o of allOthers ?? []) {
    const row = o as { conversation_id: string; participant_id: string; participant_type: string };
    if (!otherByConv.has(row.conversation_id)) otherByConv.set(row.conversation_id, { id: row.participant_id, type: row.participant_type });
  }
  const guestIds = [...otherByConv.values()].filter((o) => o.type === 'guest').map((o) => o.id);
  const staffIds = [...otherByConv.values()].filter((o) => o.type === 'staff' || o.type === 'admin').map((o) => o.id);
  const { data: guestNames } = guestIds.length ? await supabase.from('guests').select('id, full_name').in('id', guestIds) : { data: [] };
  const { data: staffNames } = staffIds.length ? await supabase.from('staff').select('id, full_name').in('id', staffIds) : { data: [] };
  const nameById = new Map<string, string>();
  for (const g of guestNames ?? []) nameById.set(g.id, (g as { full_name: string }).full_name || 'Misafir');
  for (const s of staffNames ?? []) nameById.set(s.id, (s as { full_name: string }).full_name || 'Personel');

  // Okunmamış sayısı: kullanıcının göndermediği, last_read_at sonrası mesajlar
  const { data: recentMsgs } = await supabase
    .from('messages')
    .select('id, conversation_id, created_at, sender_id, sender_type')
    .in('conversation_id', convIds)
    .eq('is_deleted', false);
  const partByConv = new Map<string | undefined, { last_read_at: string | null }>();
  for (const p of participants ?? []) {
    const row = p as { conversation_id: string; last_read_at: string | null };
    partByConv.set(row.conversation_id, { last_read_at: row.last_read_at });
  }
  const unreadByConv = new Map<string, number>();
  for (const m of recentMsgs ?? []) {
    const row = m as { conversation_id: string; created_at: string; sender_id: string; sender_type: string };
    if (row.sender_id === staffId && row.sender_type === 'staff') continue;
    const part = partByConv.get(row.conversation_id);
    const lastRead = part?.last_read_at ?? null;
    if (lastRead && new Date(row.created_at) <= new Date(lastRead)) continue;
    unreadByConv.set(row.conversation_id, (unreadByConv.get(row.conversation_id) ?? 0) + 1);
  }

  const list: ConversationWithMeta[] = convs.map((c) => {
    const lastMsg = lastMessages.find((m) => m.id === c.last_message_id);
    const part = participants.find((p: { conversation_id: string }) => p.conversation_id === c.id) as {
      last_read_at: string | null;
      is_pinned: boolean;
    } | undefined;
    const other = otherByConv.get(c.id);
    const displayName = c.name || (other ? nameById.get(other.id) || 'Sohbet' : 'Sohbet');
    return {
      ...c,
      name: displayName,
      last_message_preview: lastMsg?.content ?? null,
      unread_count: unreadByConv.get(c.id) ?? 0,
      is_pinned: part?.is_pinned ?? false,
    };
  });
  list.sort((a, b) => (new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()));
  return list;
}

export async function staffGetMessages(conversationId: string, limit = 50, beforeId?: string): Promise<Message[]> {
  let q = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (beforeId) {
    const { data: before } = await supabase.from('messages').select('created_at').eq('id', beforeId).single();
    if (before?.created_at) q = q.lt('created_at', (before as { created_at: string }).created_at);
  }
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).reverse() as Message[];
}

export async function staffSendMessage(
  conversationId: string,
  staffId: string,
  staffName: string,
  staffAvatar: string | null,
  content: string,
  messageType: 'text' | 'image' | 'file' | 'voice' = 'text',
  mediaUrl?: string
): Promise<{ data: Message | null; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: staffId,
      sender_type: 'staff',
      sender_name: staffName,
      sender_avatar: staffAvatar,
      message_type: messageType,
      content: content || null,
      media_url: mediaUrl || null,
    })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  await supabase
    .from('conversations')
    .update({ last_message_id: data.id, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  return { data: data as Message, error: null };
}

export async function staffGetOrCreateDirectConversation(
  staffId: string,
  otherId: string,
  otherType: 'guest' | 'staff' | 'admin'
): Promise<string | null> {
  const { data, error } = await supabase.rpc('messaging_get_or_create_direct', {
    p_actor_id: staffId,
    p_actor_type: 'staff',
    p_other_id: otherId,
    p_other_type: otherType,
  });
  if (error || data == null) return null;
  return data as string;
}

export async function staffMarkConversationRead(conversationId: string, staffId: string): Promise<void> {
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('participant_id', staffId)
    .in('participant_type', ['staff', 'admin']);
}

export function subscribeToMessages(conversationId: string, onMessage: (m: Message) => void) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        onMessage(payload.new as Message);
      }
    )
    .subscribe();
}

export function subscribeToConversationList(staffId: string, onUpdate: () => void) {
  return supabase
    .channel('conv_list')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversation_participants' },
      () => onUpdate()
    )
    .subscribe();
}

// ----- Guest (app_token) -----

export async function guestListConversations(appToken: string): Promise<ConversationWithMeta[]> {
  const { data, error } = await supabase.rpc('messaging_list_conversations_guest', { p_app_token: appToken });
  if (error || !data?.length) return [];
  return data as ConversationWithMeta[];
}

export async function guestGetMessages(appToken: string, conversationId: string, limit = 50, beforeId?: string): Promise<Message[]> {
  const { data, error } = await supabase.rpc('messaging_get_messages_guest', {
    p_app_token: appToken,
    p_conversation_id: conversationId,
    p_limit: limit,
    p_before_id: beforeId ?? null,
  });
  if (error || !data) return [];
  return (Array.isArray(data) ? data : [data]) as Message[];
}

export async function guestSendMessage(
  appToken: string,
  conversationId: string,
  content: string,
  messageType: 'text' | 'image' | 'file' | 'voice' = 'text',
  mediaUrl?: string | null
): Promise<string | null> {
  const { data, error } = await supabase.rpc('messaging_send_message_guest', {
    p_app_token: appToken,
    p_conversation_id: conversationId,
    p_content: content,
    p_message_type: messageType,
    p_media_url: mediaUrl ?? null,
  });
  if (error || data == null) return null;
  return data as string;
}

export async function guestGetOrCreateConversationWithStaff(appToken: string, staffId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('messaging_guest_get_or_create_with_staff', {
    p_app_token: appToken,
    p_staff_id: staffId,
  });
  if (error || data == null) return null;
  return data as string;
}

/** Misafir ses dosyasını yükler; Edge Function ile storage’a koyar, public URL döner. */
export async function uploadVoiceMessageForGuest(
  appToken: string,
  conversationId: string,
  localUri: string
): Promise<string | null> {
  const file = new File(localUri);
  const buffer = await file.arrayBuffer();
  const base64 = encodeBase64(buffer);
  const { data, error } = await supabase.functions.invoke('upload-message-media', {
    body: {
      app_token: appToken,
      conversation_id: conversationId,
      audio_base64: base64,
      mime_type: 'audio/m4a',
    },
  });
  if (error || !data?.url) return null;
  return data.url as string;
}

const MESSAGE_MEDIA_BUCKET = 'message-media';

/** Personel ses dosyasını storage'a yükler (authenticated). */
export async function uploadVoiceMessageForStaff(localUri: string): Promise<string | null> {
  const file = new File(localUri);
  const buffer = await file.arrayBuffer();
  const binary = new Uint8Array(buffer);
  const fileName = `voice/${crypto.randomUUID()}.m4a`;
  const { error } = await supabase.storage.from(MESSAGE_MEDIA_BUCKET).upload(fileName, binary, {
    contentType: 'audio/m4a',
    upsert: true,
  });
  if (error) return null;
  const { data: urlData } = supabase.storage.from(MESSAGE_MEDIA_BUCKET).getPublicUrl(fileName);
  return urlData.publicUrl;
}

/** Misafir resim mesajı: base64 + mime_type ile Edge Function'a gönderilir. */
export async function uploadImageMessageForGuest(
  appToken: string,
  conversationId: string,
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<string | null> {
  const convId = typeof conversationId === 'string' ? conversationId.trim() : conversationId;
  const token = typeof appToken === 'string' ? appToken.trim() : appToken;
  console.log('[messagingApi] uploadImageMessageForGuest: conversationId=', convId, 'mimeType=', mimeType, 'base64Len=', imageBase64?.length);
  const { data, error } = await supabase.functions.invoke('upload-message-media', {
    body: {
      app_token: token,
      conversation_id: convId,
      image_base64: imageBase64,
      mime_type: mimeType,
    },
  });
  if (error) {
    const errBody = data && typeof data === 'object' && 'error' in data ? (data as { error?: string }).error : undefined;
    console.warn('[messagingApi] upload-message-media invoke error:', error?.message, 'body:', errBody ?? data, error);
    return null;
  }
  if (!data?.url) {
    console.warn('[messagingApi] upload-message-media data.url yok, data:', typeof data === 'object' ? JSON.stringify(data).slice(0, 200) : data);
    return null;
  }
  return data.url as string;
}

/** Personel resim mesajını storage'a yükler (authenticated). arrayBuffer: uriToArrayBuffer(uri) ile alınır. */
export async function uploadImageMessageForStaff(arrayBuffer: ArrayBuffer, mimeType: string): Promise<string | null> {
  console.log('[messagingApi] uploadImageMessageForStaff: mimeType=', mimeType, 'size=', arrayBuffer?.byteLength);
  const binary = new Uint8Array(arrayBuffer);
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const fileName = `images/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MESSAGE_MEDIA_BUCKET).upload(fileName, binary, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    console.warn('[messagingApi] uploadImageMessageForStaff storage error:', error?.message, error);
    return null;
  }
  const { data: urlData } = supabase.storage.from(MESSAGE_MEDIA_BUCKET).getPublicUrl(fileName);
  return urlData.publicUrl;
}
