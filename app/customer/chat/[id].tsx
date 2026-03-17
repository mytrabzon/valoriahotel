import { useEffect, useState, useRef, useMemo } from 'react';
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
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useGuestMessagingStore } from '@/stores/guestMessagingStore';
import { getOrCreateGuestForCaller } from '@/lib/getOrCreateGuestForCaller';
import {
  guestGetMessages,
  guestSendMessage,
  subscribeToMessages,
  uploadImageMessageForGuest,
} from '@/lib/messagingApi';
import type { Message } from '@/lib/messaging';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uriToArrayBuffer, getMimeAndExt } from '@/lib/uploadMedia';
import { encode as encodeBase64 } from 'base64-arraybuffer';
import { MESSAGING_COLORS } from '@/lib/messaging';
import { supabase } from '@/lib/supabase';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';
import { Ionicons } from '@expo/vector-icons';
import { CachedImage } from '@/components/CachedImage';

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  const voiceUri = msg.message_type === 'voice' ? (msg.media_url || msg.content) : null;
  const isImage = msg.message_type === 'image' && (msg.media_url || msg.media_thumbnail);
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
        ) : isImage ? (
          <View style={styles.imageWrap}>
            <CachedImage
              uri={msg.media_thumbnail || msg.media_url || ''}
              style={styles.bubbleImage}
              contentFit="cover"
            />
          </View>
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

export default function CustomerChatScreen() {
  const { id: conversationId, name: conversationName } = useLocalSearchParams<{ id: string; name?: string }>();
  const navigation = useNavigation();
  const { appToken, setAppToken } = useGuestMessagingStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [tokenTried, setTokenTried] = useState(false);
  const listRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<ReturnType<typeof subscribeToMessages> | null>(null);
  const lastRealtimeAtRef = useRef<number>(0);

  useEffect(() => {
    if (appToken || tokenTried) return;
    (async () => {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      const row = await getOrCreateGuestForCaller(session?.user);
      if (row?.app_token) await setAppToken(row.app_token);
      setTokenTried(true);
    })();
  }, [appToken, tokenTried, setAppToken]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: conversationName || 'Sohbet',
      headerRight: () => (
        <Text style={styles.headerOnline}>🟢 Çevrimiçi</Text>
      ),
    });
  }, [navigation, conversationName]);

  useEffect(() => {
    if (!appToken || !conversationId) {
      setLoading(false);
      return;
    }
    (async () => {
      const list = await guestGetMessages(appToken, conversationId);
      setMessages(list);
      setLoading(false);
    })();
  }, [appToken, conversationId]);

  // Realtime: yeni mesaj geldiğinde listeyi güncelle; sıra ascending olduğu için altta görünür, scrollToEnd ile kaydırılır
  useEffect(() => {
    if (!conversationId) return;
    subscriptionRef.current = subscribeToMessages(conversationId, (newMsg) => {
      lastRealtimeAtRef.current = Date.now();
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    });
    return () => {
      subscriptionRef.current?.unsubscribe?.();
    };
  }, [conversationId]);

  // Sohbet odasındayken gelen mesajların listelenmesi: polling (realtime misafir tarafında bazen çalışmıyor)
  useEffect(() => {
    if (!appToken || !conversationId || loading) return;
    const poll = async () => {
      // Realtime yeni çalışıyorsa polling'i seyrekleştir (gereksiz egress/DB yükü azalt).
      if (Date.now() - lastRealtimeAtRef.current < 60_000) return;
      const list = await guestGetMessages(appToken, conversationId, 50);
      setMessages((prev) => {
        if (prev.length === list.length && prev[prev.length - 1]?.id === list[list.length - 1]?.id) return prev;
        return list;
      });
    };
    const interval = setInterval(poll, 15_000);
    return () => clearInterval(interval);
  }, [appToken, conversationId, loading]);

  // Tüm hook'lar erken return'lerden önce çağrılmalı (Rules of Hooks)
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages]
  );
  useEffect(() => {
    if (sortedMessages.length > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [sortedMessages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || !appToken || !conversationId || sending) return;
    setSending(true);
    setInput('');
    const msgId = await guestSendMessage(appToken, conversationId, text);
    setSending(false);
    if (msgId) {
      const { notifyAdmins } = await import('@/lib/notificationService');
      notifyAdmins({
        title: '💬 Yeni misafir mesajı',
        body: text.slice(0, 60) + (text.length > 60 ? '…' : ''),
        data: { url: '/admin/messages' },
      }).catch(() => {});
      const list = await guestGetMessages(appToken, conversationId, 50);
      setMessages(list);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const sendImageFromSource = async (source: 'camera' | 'library') => {
    if (!appToken || !conversationId || sending) return;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin', 'Kamera erişimi gerekli.');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin', 'Galeri erişimi gerekli.');
        return;
      }
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
        });
    if (result.canceled || !result.assets[0]?.uri) return;
    let uri = result.assets[0].uri;
    setSending(true);
    try {
      // Edge Function body limit (~1MB) için resmi küçültüp sıkıştırıyoruz
      try {
        const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], {
          compress: 0.65,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        if (manipulated?.uri) uri = manipulated.uri;
      } catch (_) {
        // Manipülasyon başarısız olursa orijinal uri ile devam et
      }
      console.log('[Chat] Resim seçildi, uri:', uri?.slice?.(0, 80));
      const arrayBuffer = await uriToArrayBuffer(uri);
      console.log('[Chat] uriToArrayBuffer OK, byteLength:', arrayBuffer?.byteLength);
      const base64 = encodeBase64(arrayBuffer);
      console.log('[Chat] base64 encode OK, length:', base64?.length);
      const { mime } = getMimeAndExt(uri, 'image');
      console.log('[Chat] mime:', mime);
      const mediaUrl = await uploadImageMessageForGuest(appToken, conversationId, base64, mime);
      if (!mediaUrl) {
        console.warn('[Chat] uploadImageMessageForGuest null döndü');
        Alert.alert('Hata', 'Resim yüklenemedi.');
        return;
      }
      console.log('[Chat] mediaUrl alındı:', mediaUrl?.slice?.(0, 60));
      const msgId = await guestSendMessage(appToken, conversationId, 'Fotoğraf', 'image', mediaUrl);
      if (msgId) {
        const { notifyAdmins } = await import('@/lib/notificationService');
        notifyAdmins({
          title: '💬 Yeni misafir mesajı',
          body: 'Fotoğraf gönderildi.',
          data: { url: '/admin/messages' },
        }).catch(() => {});
        const list = await guestGetMessages(appToken, conversationId, 50);
        setMessages(list);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (e) {
      const err = e as Error;
      console.error('[Chat] Resim yükleme hatası:', err?.message, err?.stack);
      Alert.alert('Hata', err?.message ?? 'Resim gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Fotoğraf gönder',
      undefined,
      [
        { text: 'Resim çek', onPress: () => sendImageFromSource('camera') },
        { text: 'Galeriden seç', onPress: () => sendImageFromSource('library') },
        { text: 'İptal', style: 'cancel' },
      ]
    );
  };

  if (!appToken) {
    return (
      <View style={styles.centered}>
        <Text style={styles.placeholder}>
          {tokenTried ? 'Mesajlaşma için giriş yapın.' : 'Yükleniyor…'}
        </Text>
      </View>
    );
  }

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        keyboardShouldPersistTaps="handled"
        ref={listRef}
        data={sortedMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, sortedMessages.length > 0 && styles.listContentGrow]}
        renderItem={({ item }) => (
          <MessageBubble msg={item} isOwn={item.sender_type === 'guest'} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>Henüz mesaj yok. İlk mesajı siz gönderin.</Text>}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
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
        <TouchableOpacity
          style={styles.mediaBtn}
          onPress={showImageOptions}
          disabled={sending}
          accessibilityLabel="Fotoğraf"
          activeOpacity={0.7}
        >
          <Ionicons name="camera-outline" size={24} color={MESSAGING_COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mediaBtn}
          onPress={() => sendImageFromSource('library')}
          disabled={sending}
          accessibilityLabel="Galeriden seç"
          activeOpacity={0.7}
        >
          <Ionicons name="images-outline" size={24} color={MESSAGING_COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { color: MESSAGING_COLORS.textSecondary },
  headerOnline: { fontSize: 13, color: MESSAGING_COLORS.success, fontWeight: '600', marginRight: 12 },
  listContent: { padding: 16, paddingBottom: 24 },
  listContentGrow: { flexGrow: 1 },
  bubbleWrap: { marginBottom: 10 },
  bubbleWrapOwn: { alignItems: 'flex-end' },
  bubbleWrapOther: { alignItems: 'flex-start' },
  senderName: { fontSize: 12, color: MESSAGING_COLORS.primary, marginBottom: 2, marginLeft: 12 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleOwn: { backgroundColor: MESSAGING_COLORS.primary },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  bubbleText: { fontSize: 15 },
  bubbleTextOwn: { color: '#fff' },
  bubbleTextOther: { color: MESSAGING_COLORS.text },
  bubbleTime: { fontSize: 11, marginTop: 4 },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.85)' },
  bubbleTimeOther: { color: MESSAGING_COLORS.textSecondary },
  imageWrap: { marginTop: 2 },
  bubbleImage: { width: 200, height: 200, borderRadius: 12 },
  empty: { textAlign: 'center', color: MESSAGING_COLORS.textSecondary, marginTop: 24 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 48,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 6,
  },
  mediaBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(197, 160, 89, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(197, 160, 89, 0.25)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MESSAGING_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
    shadowColor: MESSAGING_COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
});
