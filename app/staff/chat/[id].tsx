import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, Stack, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import {
  staffGetMessages,
  staffSendMessage,
  staffMarkConversationRead,
  subscribeToMessages,
  uploadVoiceMessageForStaff,
  uploadImageMessageForStaff,
} from '@/lib/messagingApi';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/lib/messaging';
import { theme } from '@/constants/theme';
import { useVoiceRecorder } from '@/lib/useVoiceRecorder';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';
import * as ImagePicker from 'expo-image-picker';
import { uriToArrayBuffer, getMimeAndExt } from '@/lib/uploadMedia';
import { CachedImage } from '@/components/CachedImage';

const ALL_STAFF_GROUP_NAME = 'Tüm Çalışanlar';

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDateAndTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ msg, isOwn, isGroup }: { msg: Message; isOwn: boolean; isGroup: boolean }) {
  const voiceUri = msg.message_type === 'voice' ? (msg.media_url || msg.content) : null;
  const isImage = msg.message_type === 'image' && (msg.media_url || msg.media_thumbnail);
  const initial = (msg.sender_name || '?').charAt(0).toUpperCase();
  const timeStr = isGroup ? formatMessageDateAndTime(msg.created_at) : formatMessageTime(msg.created_at);

  const renderContent = (own: boolean) => {
    if (msg.message_type === 'text') {
      return <Text style={own ? styles.bubbleTextOwn : styles.bubbleTextOther}>{msg.content || ''}</Text>;
    }
    if (msg.message_type === 'voice' && voiceUri) {
      return <VoiceMessagePlayer uri={voiceUri} isOwn={own} />;
    }
    if (isImage) {
      return (
        <View style={styles.imageWrap}>
          <CachedImage
            uri={msg.media_thumbnail || msg.media_url || ''}
            style={styles.bubbleImage}
            contentFit="cover"
          />
        </View>
      );
    }
    return (
      <Text style={own ? styles.bubbleTextOwn : styles.bubbleTextOther}>
        [{msg.message_type}] {msg.content || msg.media_url || '—'}
      </Text>
    );
  };

  return (
    <View style={[styles.bubbleWrap, isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}>
      {!isOwn && (
        <View style={styles.otherMeta}>
          {isGroup && (
            <View style={styles.avatarWrap}>
              {msg.sender_avatar ? (
                <CachedImage uri={msg.sender_avatar} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.otherContent}>
            {isGroup && msg.sender_name ? (
              <Text style={styles.senderName}>{msg.sender_name}</Text>
            ) : null}
            <View style={[styles.bubble, styles.bubbleOther]}>
              {renderContent(false)}
              <View style={styles.bubbleFooter}>
                <Text style={styles.bubbleTimeOther}>{timeStr}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
      {isOwn && (
        <View style={[styles.bubble, styles.bubbleOwn]}>
          {renderContent(true)}
          <View style={styles.bubbleFooter}>
            <Text style={styles.bubbleTimeOwn}>{timeStr}</Text>
            {msg.is_read ? (
              <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.9)" style={styles.readIcon} />
            ) : (
              <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.9)" style={styles.readIcon} />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default function StaffChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { staff } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationType, setConversationType] = useState<string>('direct');
  const [conversationName, setConversationName] = useState<string>('Sohbet');
  const [isAllStaffGroup, setIsAllStaffGroup] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<ReturnType<typeof subscribeToMessages> | null>(null);
  const voice = useVoiceRecorder();

  useEffect(() => {
    if (!conversationId) return;
    supabase
      .from('conversations')
      .select('type, name')
      .eq('id', conversationId)
      .single()
      .then(({ data }) => {
        const row = data as { type: string; name: string | null } | null;
        const name = row?.name ?? 'Sohbet';
        setConversationType(row?.type ?? 'direct');
        setConversationName(name);
        const isAllStaff = row?.type === 'group' && row?.name === ALL_STAFF_GROUP_NAME;
        setIsAllStaffGroup(isAllStaff);
        navigation.setOptions({
          title: name,
          headerStyle: {
            backgroundColor: theme.colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.borderLight,
          },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
          headerRight: isAllStaff
            ? () => (
                <View style={styles.headerGroupBadge}>
                  <Ionicons name="people" size={18} color={theme.colors.primary} />
                  <Text style={styles.headerGroupBadgeText}>Grup</Text>
                </View>
              )
            : undefined,
        });
      });
  }, [conversationId, navigation]);

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
    return () => subscriptionRef.current?.unsubscribe?.();
  }, [conversationId]);

  // Android: klavye açılınca mesaj kutusu klavyenin üstünde kalsın
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || !staff || !conversationId || sending) return;
    setSending(true);
    setInput('');
    const { data: sent, error } = await staffSendMessage(
      conversationId,
      staff.id,
      staff.full_name || staff.email,
      staff.profile_image ?? null,
      text
    );
    setSending(false);
    if (error) {
      setInput(text);
      Alert.alert('Mesaj gönderilemedi', error);
      return;
    }
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
    const { data: sent, error } = await staffSendMessage(
      conversationId,
      staff.id,
      staff.full_name || staff.email,
      staff.profile_image ?? null,
      'Sesli mesaj',
      'voice',
      mediaUrl
    );
    setSending(false);
    if (error) {
      Alert.alert('Mesaj gönderilemedi', error);
      return;
    }
    if (sent) {
      const list = await staffGetMessages(conversationId);
      setMessages(list);
      listRef.current?.scrollToEnd({ animated: true });
    }
  };

  const sendImageFromSource = async (source: 'camera' | 'library') => {
    if (!staff || !conversationId || sending) return;
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
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    setSending(true);
    try {
      console.log('[StaffChat] Resim seçildi, uri:', uri?.slice?.(0, 80));
      const arrayBuffer = await uriToArrayBuffer(uri);
      console.log('[StaffChat] uriToArrayBuffer OK, byteLength:', arrayBuffer?.byteLength);
      const { mime } = getMimeAndExt(uri, 'image');
      console.log('[StaffChat] mime:', mime);
      const mediaUrl = await uploadImageMessageForStaff(arrayBuffer, mime);
      if (!mediaUrl) {
        console.warn('[StaffChat] uploadImageMessageForStaff null döndü');
        Alert.alert('Hata', 'Resim yüklenemedi.');
        return;
      }
      console.log('[StaffChat] mediaUrl alındı:', mediaUrl?.slice?.(0, 60));
      const { data: sent, error } = await staffSendMessage(
        conversationId,
        staff.id,
        staff.full_name || staff.email,
        staff.profile_image ?? null,
        'Fotoğraf',
        'image',
        mediaUrl
      );
      if (error) {
        Alert.alert('Mesaj gönderilemedi', error);
        return;
      }
      if (sent) {
        const list = await staffGetMessages(conversationId);
        setMessages(list);
        listRef.current?.scrollToEnd({ animated: true });
      }
    } catch (e) {
      const err = e as Error;
      console.error('[StaffChat] Resim yükleme hatası:', err?.message, err?.stack);
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

  if (!staff) return null;

  const isGroup = conversationType === 'group';

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen
          options={{
            title: conversationName,
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.text,
          }}
        />
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingLabel}>Mesajlar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: conversationName,
          headerStyle: {
            backgroundColor: theme.colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.borderLight,
          },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
        }}
      />
      <KeyboardAvoidingView
        style={[
          styles.container,
          Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MessageBubble
              msg={item}
              isOwn={item.sender_id === staff?.id}
              isGroup={isGroup}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubble-outline" size={40} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Henüz mesaj yok</Text>
              <Text style={styles.emptyText}>
                {isGroup ? 'Grup sohbetinde ilk mesajı siz yazın.' : 'Bu sohbette ilk mesajı siz yazın.'}
              </Text>
            </View>
          }
        />
        {voice.state === 'recording' && (
          <View style={styles.voiceBar}>
            <View style={styles.voiceDot} />
            <Text style={styles.voiceBarText}>{voice.durationSec} sn</Text>
            <Pressable style={styles.voiceCancelBtn} onPress={voice.cancelRecording}>
              <Text style={styles.voiceCancelText}>İptal</Text>
            </Pressable>
            <Pressable style={styles.voiceSendBtn} onPress={sendVoice} disabled={sending}>
              {sending ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Ionicons name="send" size={18} color={theme.colors.white} />
              )}
            </Pressable>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yaz..."
            placeholderTextColor={theme.colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            onSubmitEditing={send}
          />
          <TouchableOpacity style={styles.mediaBtn} onPress={showImageOptions} disabled={sending} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={() => sendImageFromSource('library')} disabled={sending} activeOpacity={0.7}>
            <Ionicons name="images-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          {(voice.state === 'idle' || voice.state === 'error') && (
            <TouchableOpacity style={styles.micBtn} onPress={startVoice} activeOpacity={0.7}>
              <Ionicons name="mic-outline" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
          >
            {sending && voice.state !== 'recording' ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Ionicons name="send" size={20} color={theme.colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingLabel: {
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  headerGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryLight,
  },
  headerGroupBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  bubbleWrap: {
    marginBottom: 14,
  },
  bubbleWrapOwn: {
    alignItems: 'flex-end',
  },
  bubbleWrapOther: {
    alignItems: 'flex-start',
  },
  otherMeta: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  otherContent: {
    flex: 1,
    minWidth: 0,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
    marginLeft: 2,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    ...theme.shadows.sm,
  },
  bubbleOwn: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  bubbleTextOwn: {
    color: theme.colors.white,
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextOther: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 4,
  },
  bubbleTimeOwn: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.88)',
  },
  bubbleTimeOther: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  readIcon: {
    marginLeft: 2,
  },
  imageWrap: { marginTop: 2 },
  bubbleImage: { width: 200, height: 200, borderRadius: 12 },
  mediaBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight ?? 'rgba(197, 160, 89, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight ?? 'rgba(197, 160, 89, 0.25)',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : 36,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.primaryLight,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    gap: 14,
  },
  voiceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.error,
  },
  voiceBarText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  voiceCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  voiceCancelText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
  voiceSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
