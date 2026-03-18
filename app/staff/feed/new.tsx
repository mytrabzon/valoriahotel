import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { uriToArrayBuffer } from '@/lib/uploadMedia';
import { CachedImage } from '@/components/CachedImage';

const VISIBILITY_OPTIONS = [
  { value: 'all_staff', label: 'Tüm personel' },
  { value: 'my_team', label: 'Sadece ekibim (aynı departman)' },
  { value: 'managers_only', label: 'Sadece yöneticiler' },
  { value: 'customers', label: 'Müşteri ana sayfasında da görünsün (personel + müşteriler)' },
] as const;

const BUCKET = 'feed-media';

export default function NewFeedPostScreen() {
  const router = useRouter();
  const { staff } = useAuthStore();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<string>('all_staff');
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin', 'Galeri erişimi gerekli.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri ?? null;
    if (!uri) {
      Alert.alert('Hata', 'Görsel yüklenemedi. Tekrar deneyin.');
      return;
    }
    setImageUri(uri);
    setMediaType(asset.type === 'video' ? 'video' : 'image');
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin', 'Kamera erişimi gerekli.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri ?? null;
    if (!uri) {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi. Tekrar deneyin.');
      return;
    }
    setImageUri(uri);
    setMediaType(asset.type === 'video' ? 'video' : 'image');
  };

  const uploadAndPublish = async () => {
    if (!staff) return;
    const hasText = (title ?? '').trim().length > 0;
    if (!hasText && !imageUri) {
      Alert.alert('Eksik', 'Lütfen metin yazın veya fotoğraf/video ekleyin.');
      return;
    }
    setUploading(true);
    try {
      let finalMediaType: 'image' | 'video' | 'text' = 'text';
      let mediaUrl: string | null = null;
      let thumbnailUrl: string | null = null;

      if (imageUri) {
        finalMediaType = mediaType;
        const ext = mediaType === 'video' ? 'mp4' : 'jpg';
        const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        const fileName = `${staff.id}/${Date.now()}.${ext}`;
        let arrayBuffer: ArrayBuffer;
        try {
          arrayBuffer = await uriToArrayBuffer(imageUri);
        } catch (e) {
          const msg = (e as Error)?.message ?? '';
          setUploading(false);
          Alert.alert('Medya okunamadı', msg.includes('base64') || msg.includes('okunamadı') ? 'Görsel/video işlenemedi. Lütfen tekrar seçin.' : msg);
          return;
        }
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(fileName, arrayBuffer, {
          contentType,
          upsert: true,
        });
        if (uploadErr) {
          setUploading(false);
          Alert.alert('Yükleme hatası', uploadErr.message);
          return;
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        mediaUrl = urlData.publicUrl;
        thumbnailUrl = mediaType === 'image' ? mediaUrl : null;
      }

      const { data: insertedPost, error: insertErr } = await supabase
        .from('feed_posts')
        .insert({
          staff_id: staff.id,
          media_type: finalMediaType,
          media_url: mediaUrl,
          thumbnail_url: thumbnailUrl,
          title: (title ?? '').trim() || null,
          visibility,
        })
        .select('id')
        .single();
      if (insertErr || !insertedPost?.id) {
        setUploading(false);
        Alert.alert('Hata', insertErr?.message ?? 'Paylaşım kaydedilemedi.');
        return;
      }
      const newPostId = insertedPost.id;
      const authorLabel = staff.full_name ?? 'Bir çalışan';
      const titleShort = (title ?? '').trim().slice(0, 50) + ((title ?? '').trim().length > 50 ? '…' : '') || 'Yeni paylaşım';
      const notifData = { screen: 'staff_feed', url: '/staff/feed', postId: newPostId };
      try {
        const { data: staffRows } = await supabase.from('staff').select('id').eq('is_active', true);
        const allStaffIds = (staffRows ?? []).map((r: { id: string }) => r.id);
        const staffIdsToNotify = allStaffIds.filter((id) => id !== staff.id);
        if (staffIdsToNotify.length > 0) {
          await supabase.from('notifications').insert(
            staffIdsToNotify.map((staffId) => ({
              staff_id: staffId,
              title: 'Yeni paylaşım',
              body: `${authorLabel}: ${titleShort}`,
              category: 'staff',
              notification_type: 'feed_post',
              data: { postId: newPostId, url: '/staff/feed' },
              created_by: staff.id,
              sent_via: 'both',
              sent_at: new Date().toISOString(),
            }))
          );
          await supabase.functions.invoke('send-expo-push', {
            body: {
              staffIds: staffIdsToNotify,
              title: 'Yeni paylaşım',
              body: `${authorLabel}: ${titleShort}`,
              data: notifData,
            },
          });
        }
      } catch (_) {
        // push veya bildirim kaydı gönderilemezse sessizce devam et
      }
      router.back();
    } catch (e) {
      setUploading(false);
      Alert.alert('Hata', (e as Error)?.message ?? 'Paylaşım kaydedilemedi.');
    }
  };

  if (!staff) return null;

  return (
    <>
      <Stack.Screen options={{ title: 'Yeni paylaşım', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#1a1d21' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Metin (sadece metinle de paylaşabilirsiniz)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Ne paylaşmak istiyorsunuz?"
          placeholderTextColor="#9ca3af"
          value={title}
          onChangeText={setTitle}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>📍 Kimler görebilir?</Text>
        {VISIBILITY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.radioRow, visibility === opt.value && styles.radioRowActive]}
            onPress={() => setVisibility(opt.value)}
            disabled={uploading}
          >
            <Text style={styles.radioLabel}>{opt.label}</Text>
            {visibility === opt.value && <Text style={styles.radioCheck}>✓</Text>}
          </TouchableOpacity>
        ))}

        <Text style={[styles.label, { marginTop: 24 }]}>Fotoğraf veya video (isteğe bağlı)</Text>
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={[styles.mediaBtn, styles.mediaBtnPhoto]} onPress={takePhoto} disabled={uploading}>
            <Text style={styles.mediaBtnTextPhoto}>📷 Fotoğraf çek</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mediaBtn, styles.mediaBtnGallery]} onPress={pickImage} disabled={uploading}>
            <Text style={styles.mediaBtnTextGallery}>📁 Galeriden seç</Text>
          </TouchableOpacity>
        </View>

        {imageUri ? (
          <View style={styles.previewWrap}>
            {mediaType === 'image' ? (
              <CachedImage uri={imageUri} style={styles.preview} contentFit="cover" />
            ) : (
              <View style={styles.preview}>
                <Text style={styles.previewVideoText}>🎥 Video seçildi</Text>
              </View>
            )}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
          onPress={uploadAndPublish}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Paylaş</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 20, paddingBottom: 40 },
  buttonsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  mediaBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  mediaBtnPhoto: {
    backgroundColor: '#0ea5e9',
  },
  mediaBtnGallery: {
    backgroundColor: '#8b5cf6',
  },
  mediaBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  mediaBtnTextPhoto: { fontSize: 15, fontWeight: '600', color: '#fff' },
  mediaBtnTextGallery: { fontSize: 15, fontWeight: '600', color: '#fff' },
  previewWrap: { marginBottom: 20 },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  previewVideoText: { fontSize: 18, color: '#374151', textAlign: 'center', marginTop: '40%' },
  label: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1d21',
    marginBottom: 20,
  },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  radioRowActive: { borderColor: '#b8860b' },
  radioLabel: { fontSize: 15, color: '#374151' },
  radioCheck: { color: '#b8860b', fontWeight: '700', fontSize: 18 },
  submitBtn: {
    backgroundColor: '#b8860b',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
