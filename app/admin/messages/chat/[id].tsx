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
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { uriToArrayBuffer, getMimeAndExt } from '@/lib/uploadMedia';
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
import { MESSAGING_COLORS } from '@/lib/messaging';
import { useVoiceRecorder } from '@/lib/useVoiceRecorder';
import { VoiceMessagePlayer } from '@/components/VoiceMessagePlayer';
import { Ionicons } from '@expo/vector-icons';
import { CachedImage } from '@/components/CachedImage';

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDateAndTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MessageBubble({
  msg,
  isOwn,
  isGroup,
}: {
  msg: Message;
  isOwn: boolean;
  isGroup: boolean;
}) {
  const voiceUri = msg.message_type === 'voice' ? (msg.media_url || msg.content) : null;
  const isImage = msg.message_type === 'image' && (msg.media_url || msg.media_thumbnail);
  const initial = (msg.sender_name || '?').charAt(0).toUpperCase();
  const timeStr = isGroup ? formatMessageDateAndTime(msg.created_at) : formatMessageTime(msg.created_at);
  return (
    <View style={[styles.bubbleWrap, isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}>
      {!isOwn && (
        <View style={styles.otherMeta}>
          {isGroup && (
            <View style={styles.avatarWrap}>
              {msg.sender_avatar ? (
                <CachedImage uri={msg.sender_avatar} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{initial}</Text></View>
              )}
            </View>
          )}
          <View style={styles.otherContent}>
            {isGroup && msg.sender_name ? <Text style={styles.senderName}>{msg.sender_name}</Text> : null}
            <View style={[styles.bubble, styles.bubbleOther]}>
              {msg.message_type === 'text' ? (
                <Text style={[styles.bubbleText, styles.bubbleTextOther]}>{msg.content || ''}</Text>
              ) : msg.message_type === 'voice' && voiceUri ? (
                <VoiceMessagePlayer uri={voiceUri} isOwn={false} />
              ) : isImage ? (
                <View style={styles.imageWrap}>
                  <CachedImage uri={msg.media_thumbnail || msg.media_url || ''} style={styles.bubbleImage} contentFit="cover" />
                </View>
              ) : (
                <Text style={[styles.bubbleText, styles.bubbleTextOther]}>
                  [{msg.message_type}] {msg.content || msg.media_url || '—'}
                </Text>
              )}
              <Text style={[styles.bubbleTime, styles.bubbleTimeOther]}>
                {timeStr}
              </Text>
            </View>
          </View>
        </View>
      )}
      {isOwn && (
        <View style={[styles.bubble, styles.bubbleOwn]}>
          {msg.message_type === 'text' ? (
            <Text style={[styles.bubbleText, styles.bubbleTextOwn]}>{msg.content || ''}</Text>
          ) : msg.message_type === 'voice' && voiceUri ? (
            <VoiceMessagePlayer uri={voiceUri} isOwn={true} />
          ) : isImage ? (
            <View style={styles.imageWrap}>
              <CachedImage uri={msg.media_thumbnail || msg.media_url || ''} style={styles.bubbleImage} contentFit="cover" />
            </View>
          ) : (
            <Text style={[styles.bubbleText, styles.bubbleTextOwn]}>
              [{msg.message_type}] {msg.content || msg.media_url || '—'}
            </Text>
          )}
          <Text style={[styles.bubbleTime, styles.bubbleTimeOwn]}>
            {timeStr}
            {msg.is_read ? ' ✓✓' : ' ✓'}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AdminChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { staff } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationType, setConversationType] = useState<string>('direct');
  const [conversationName, setConversationName] = useState<string>('');
  const [conversationAvatar, setConversationAvatar] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupAvatar, setEditGroupAvatar] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const listRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<ReturnType<typeof subscribeToMessages> | null>(null);
  const voice = useVoiceRecorder();

  const isAdmin = staff?.role === 'admin';
  const isGroup = conversationType === 'group';
  const canEditGroup = isAdmin && isGroup;

  const navigation = useNavigation();
  useEffect(() => {
    if (!conversationId) return;
    supabase
      .from('conversations')
      .select('type, name, avatar')
      .eq('id', conversationId)
      .single()
      .then(({ data }) => {
        const row = data as { type: string; name: string | null; avatar: string | null } | null;
        setConversationType(row?.type ?? 'direct');
        const name = row?.name ?? 'Sohbet';
        const avatar = row?.avatar ?? null;
        setConversationName(name);
        setConversationAvatar(avatar);
        navigation.setOptions({ title: name });
      });
  }, [conversationId, navigation]);

  useEffect(() => {
    if (!canEditGroup) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            setEditGroupName(conversationName);
            setEditGroupAvatar(conversationAvatar);
            setShowGroupSettings(true);
          }}
          style={{ padding: 8, marginRight: 4 }}
          accessibilityLabel="Grup ayarları"
        >
          <Text style={{ color: MESSAGING_COLORS.primary, fontWeight: '600', fontSize: 15 }}>Ayarlar</Text>
        </TouchableOpacity>
      ),
    });
    return () => navigation.setOptions({ headerRight: undefined });
  }, [canEditGroup, conversationName, conversationAvatar, navigation]);

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
      console.log('[AdminChat] Resim seçildi, uri:', uri?.slice?.(0, 80));
      const arrayBuffer = await uriToArrayBuffer(uri);
      console.log('[AdminChat] uriToArrayBuffer OK, byteLength:', arrayBuffer?.byteLength);
      const { mime } = getMimeAndExt(uri, 'image');
      console.log('[AdminChat] mime:', mime);
      const mediaUrl = await uploadImageMessageForStaff(arrayBuffer, mime);
      if (!mediaUrl) {
        console.warn('[AdminChat] uploadImageMessageForStaff null döndü');
        Alert.alert('Hata', 'Resim yüklenemedi.');
        return;
      }
      console.log('[AdminChat] mediaUrl alındı:', mediaUrl?.slice?.(0, 60));
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
      console.error('[AdminChat] Resim yükleme hatası:', err?.message, err?.stack);
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

  const uploadGroupAvatar = async (uri: string): Promise<string> => {
    const arrayBuffer = await uriToArrayBuffer(uri);
    const ext = uri.toLowerCase().includes('.png') ? 'png' : 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `conversations/${conversationId}.${ext}`;
    const { error } = await supabase.storage.from('profiles').upload(fileName, arrayBuffer, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(fileName);
    return publicUrl;
  };

  const pickAvatarForGroup = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin', 'Galeri erişimi gerekli.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadGroupAvatar(result.assets[0].uri);
      setEditGroupAvatar(url);
    } catch (e) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Fotoğraf yüklenemedi.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveGroupSettings = async () => {
    if (!conversationId || savingGroup) return;
    const name = (editGroupName || '').trim() || conversationName;
    setSavingGroup(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ name, avatar: editGroupAvatar ?? null, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      if (error) {
        Alert.alert('Hata', error.message);
        return;
      }
      setConversationName(name);
      setConversationAvatar(editGroupAvatar);
      navigation.setOptions({ title: name });
      setShowGroupSettings(false);
    } finally {
      setSavingGroup(false);
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
      style={[
        styles.container,
        Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        keyboardShouldPersistTaps="handled"
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <MessageBubble
            msg={item}
            isOwn={item.sender_id === staff?.id}
            isGroup={conversationType === 'group'}
          />
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
        <TouchableOpacity style={styles.mediaBtn} onPress={showImageOptions} disabled={sending} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={22} color={MESSAGING_COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaBtn} onPress={() => sendImageFromSource('library')} disabled={sending} activeOpacity={0.7}>
          <Ionicons name="images-outline" size={22} color={MESSAGING_COLORS.primary} />
        </TouchableOpacity>
        {voice.state === 'idle' || voice.state === 'error' ? (
          <TouchableOpacity style={styles.micBtn} onPress={startVoice}>
            <Text style={styles.micBtnText}>🎤</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
          activeOpacity={0.85}
        >
          {sending && voice.state !== 'recording' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showGroupSettings} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setShowGroupSettings(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalBox}>
            <Text style={styles.modalTitle}>Grup ayarları</Text>
            <View style={styles.modalAvatarRow}>
              <TouchableOpacity
                onPress={pickAvatarForGroup}
                disabled={uploadingAvatar}
                style={styles.modalAvatarTouch}
              >
                {editGroupAvatar ? (
                  <CachedImage uri={editGroupAvatar} style={styles.modalAvatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.modalAvatarPlaceholder}>
                    <Text style={styles.modalAvatarPlaceholderText}>Fotoğraf</Text>
                  </View>
                )}
                {uploadingAvatar && (
                  <View style={styles.modalAvatarLoading}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.modalAvatarHint}>Profil resmi</Text>
            </View>
            <Text style={styles.modalLabel}>Grup adı</Text>
            <TextInput
              style={styles.modalInput}
              value={editGroupName}
              onChangeText={setEditGroupName}
              placeholder="Örn: Tüm Çalışanlar"
              placeholderTextColor={MESSAGING_COLORS.textSecondary}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowGroupSettings(false)}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingGroup && styles.modalSaveBtnDisabled]}
                onPress={saveGroupSettings}
                disabled={savingGroup}
              >
                {savingGroup ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12, paddingBottom: 16 },
  bubbleWrap: { marginBottom: 12 },
  bubbleWrapOwn: { alignItems: 'flex-end' },
  bubbleWrapOther: { alignItems: 'flex-start' },
  otherMeta: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  otherContent: { flex: 1, minWidth: 0 },
  avatarWrap: { width: 36, height: 36, borderRadius: 18 },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MESSAGING_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: '700', fontSize: 16 },
  senderName: { fontSize: 12, color: MESSAGING_COLORS.primary, marginBottom: 2, marginLeft: 4 },
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
  imageWrap: { marginTop: 2 },
  bubbleImage: { width: 200, height: 200, borderRadius: 12 },
  empty: { textAlign: 'center', color: MESSAGING_COLORS.textSecondary, marginTop: 24 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 48,
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
  mediaBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(197, 160, 89, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(197, 160, 89, 0.25)',
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: MESSAGING_COLORS.text, marginBottom: 20 },
  modalAvatarRow: { alignItems: 'center', marginBottom: 20 },
  modalAvatarTouch: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', alignSelf: 'center' },
  modalAvatarImg: { width: 80, height: 80 },
  modalAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: MESSAGING_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarPlaceholderText: { color: '#fff', fontSize: 12 },
  modalAvatarLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarHint: { fontSize: 12, color: MESSAGING_COLORS.textSecondary, marginTop: 8 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: MESSAGING_COLORS.text, marginBottom: 8 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { color: MESSAGING_COLORS.textSecondary, fontWeight: '600' },
  modalSaveBtn: {
    backgroundColor: MESSAGING_COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  modalSaveBtnDisabled: { opacity: 0.7 },
  modalSaveText: { color: '#fff', fontWeight: '600' },
});
