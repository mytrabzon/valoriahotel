import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import {
  staffGetMessages,
  staffSendMessage,
  staffMarkConversationRead,
  subscribeToMessages,
  uploadVoiceMessageForStaff,
} from '@/lib/messagingApi';
import type { Message } from '@/lib/messaging';
import { MESSAGING_COLORS } from '@/lib/messaging';
import { useVoiceRecorder } from '@/lib/useVoiceRecorder';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  const voiceUri = msg.message_type === 'voice' ? (msg.media_url || msg.content) : null;
  return (
    <View style={[styles.bubbleWrap, isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}>
      {!isOwn && msg.sender_name ? <Text style={styles.senderName}>{msg.sender_name}</Text> : null}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {msg.message_type === 'text' ? (
          <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
            {msg.content || ''}
          </Text>
        ) : msg.message_type === 'voice' && voiceUri ? (
          <VoiceMessagePlayer uri={voiceUri} isOwn={isOwn} />
        ) : (
          <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
            [{msg.message_type}] {msg.content || msg.media_url || '—'}
          </Text>
        )}
        <Text style={[styles.bubbleTime, isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeOther]}>
          {formatMessageTime(msg.created_at)}
          {isOwn && (msg.is_read ? ' ✓✓' : ' ✓')}
        </Text>
      </View>
    </View>
  );
}

export default function AdminChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { staff } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<ReturnType<typeof subscribeToMessages> | null>(null);
  const voice = useVoiceRecorder();

  useEffect(() => {
    if (!staff || !conversationId) {
      setLoading(false);
      return;
    }
    (async () => {
      const list = await staffGetMessages(conversationId);
      setMessages(list);
      staffMarkConversationRead(conversationId, staff.id);
      setLoading(false);
    })();
  }, [staff?.id, conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    subscriptionRef.current = subscribeToMessages(conversationId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => {
      subscriptionRef.current?.unsubscribe?.();
    };
  }, [conversationId]);

  const send = async () => {
    const text = input.trim();
    if (!text || !staff || !conversationId || sending) return;
    setSending(true);
    setInput('');
    const sent = await staffSendMessage(
      conversationId,
      staff.id,
      staff.full_name || staff.email,
      null,
      text
    );
    setSending(false);
    if (sent) {
      const list = await staffGetMessages(conversationId);
      setMessages(list);
      listRef.current?.scrollToEnd({ animated: true });
    }
  };

  const startVoice = async () => {
    const err = await voice.startRecording();
    if (err) Alert.alert('Ses kaydı', err);
  };

  const sendVoice = async () => {
    const uri = await voice.stopRecording();
    voice.reset();
    if (!uri || !staff || !conversationId || sending) return;
    if (voice.durationSec < 1) {
      Alert.alert('Çok kısa', 'En az 1 saniye kayıt yapın.');
      return;
    }
    setSending(true);
    const mediaUrl = await uploadVoiceMessageForStaff(uri);
    if (!mediaUrl) {
      setSending(false);
      Alert.alert('Hata', 'Ses yüklenemedi. Tekrar deneyin.');
      return;
    }
    const sent = await staffSendMessage(
      conversationId,
      staff.id,
      staff.full_name || staff.email,
      null,
      'Sesli mesaj',
      'voice',
      mediaUrl
    );
    setSending(false);
    if (sent) {
      const list = await staffGetMessages(conversationId);
      setMessages(list);
      listRef.current?.scrollToEnd({ animated: true });
    }
  };

  if (!staff) return null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={MESSAGING_COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <MessageBubble msg={item} isOwn={item.sender_type === 'staff' || item.sender_type === 'admin'} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>Henüz mesaj yok.</Text>}
      />
      {voice.state === 'recording' && (
        <View style={styles.voiceBar}>
          <Text style={styles.voiceBarText}>🔴 {voice.durationSec} sn</Text>
          <TouchableOpacity style={styles.voiceCancelBtn} onPress={voice.cancelRecording}>
            <Text style={styles.voiceCancelText}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.voiceSendBtn} onPress={sendVoice} disabled={sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.voiceSendText}>Gönder</Text>}
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Mesaj yaz..."
          placeholderTextColor={MESSAGING_COLORS.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          onSubmitEditing={send}
        />
        {voice.state === 'idle' || voice.state === 'error' ? (
          <TouchableOpacity style={styles.micBtn} onPress={startVoice}>
            <Text style={styles.micBtnText}>🎤</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
        >
          {sending && voice.state !== 'recording' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendBtnText}>Gönder</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12, paddingBottom: 16 },
  bubbleWrap: { marginBottom: 8 },
  bubbleWrapOwn: { alignItems: 'flex-end' },
  bubbleWrapOther: { alignItems: 'flex-start' },
  senderName: { fontSize: 12, color: MESSAGING_COLORS.primary, marginBottom: 2, marginLeft: 12 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleOwn: { backgroundColor: MESSAGING_COLORS.primary },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  bubbleText: { fontSize: 15 },
  bubbleTextOwn: { color: '#fff' },
  bubbleTextOther: { color: MESSAGING_COLORS.text },
  bubbleTime: { fontSize: 11, marginTop: 4 },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.85)' },
  bubbleTimeOther: { color: MESSAGING_COLORS.textSecondary },
  empty: { textAlign: 'center', color: MESSAGING_COLORS.textSecondary, marginTop: 24 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: MESSAGING_COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 40,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  micBtnText: { fontSize: 20 },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff3e0',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  voiceBarText: { fontSize: 14, color: '#1a202c' },
  voiceCancelBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  voiceCancelText: { color: MESSAGING_COLORS.textSecondary, fontWeight: '600' },
  voiceSendBtn: {
    backgroundColor: MESSAGING_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  voiceSendText: { color: '#fff', fontWeight: '600' },
});
