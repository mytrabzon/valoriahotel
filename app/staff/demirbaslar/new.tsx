import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { uploadUriToPublicBucket } from '@/lib/storagePublicUpload';
import { CachedImage } from '@/components/CachedImage';
import { theme } from '@/constants/theme';
import { FIXED_ASSET_STATUSES } from '@/lib/fixedAssets';
import { ImagePreviewModal } from '@/components/ImagePreviewModal';
import { ensureCameraPermission } from '@/lib/cameraPermission';
import { ensureMediaLibraryPermission } from '@/lib/mediaLibraryPermission';

export default function NewFixedAssetScreen() {
  const router = useRouter();
  const { staff } = useAuthStore();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string>(FIXED_ASSET_STATUSES[0].value);
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [brandModel, setBrandModel] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const pickPhotos = async () => {
    const granted = await ensureMediaLibraryPermission({
      title: 'Galeri izni',
      message: 'Demirbaş fotoğrafı seçmek için galeri erişimi gerekiyor.',
      settingsMessage: 'Galeri izni kapalı. Ayarlardan galeri iznini açın.',
    });
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.65,
    });
    if (result.canceled || result.assets.length === 0) return;
    const pickedUris = result.assets.map((a) => a.uri).filter(Boolean);
    setPhotos((prev) => [...prev, ...pickedUris]);
  };

  const takePhoto = async () => {
    const granted = await ensureCameraPermission({
      title: 'Kamera izni',
      message: 'Demirbaş fotoğrafı çekmek için kamera erişimi gerekiyor.',
      settingsMessage: 'Kamera izni kapalı. Ayarlardan kamera iznini açın.',
    });
    if (!granted) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.65,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setPhotos((prev) => [...prev, result.assets[0].uri]);
  };

  const save = async () => {
    if (!staff?.id || !staff.organization_id) return Alert.alert('Hata', 'Oturum bilgisi eksik.');
    if (!name.trim()) return Alert.alert('Eksik', 'Demirbaş adı zorunlu.');
    if (!photos.length) return Alert.alert('Eksik', 'En az bir fotoğraf ekleyin.');
    const qty = Number.parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) return Alert.alert('Eksik', 'Adet en az 1 olmalı.');

    setSaving(true);
    try {
      const uploadedPhotoUrls = await Promise.all(
        photos.map(async (uri) => {
          const { publicUrl } = await uploadUriToPublicBucket({
            bucketId: 'stock-proofs',
            uri,
            subfolder: 'demirbaslar',
          });
          return publicUrl;
        })
      );

      const emptyMeta = '';
      const { data: asset, error } = await supabase
        .from('fixed_assets')
        .insert({
          organization_id: staff.organization_id,
          category: emptyMeta,
          name: name.trim(),
          location: emptyMeta,
          status,
          quantity: qty,
          note: note.trim() || null,
          brand_model: brandModel.trim() || null,
          serial_no: serialNo.trim() || null,
          added_by: staff.id,
          last_updated_by: staff.id,
          last_seen_location: emptyMeta,
        })
        .select('id')
        .single();

      if (error || !asset) {
        setSaving(false);
        return Alert.alert('Hata', error?.message ?? 'Kayıt oluşturulamadı.');
      }

      await supabase
        .from('fixed_asset_photos')
        .insert(uploadedPhotoUrls.map((url) => ({ asset_id: asset.id, photo_url: url, created_by: staff.id })));
      await supabase.from('fixed_asset_history').insert({
        asset_id: asset.id,
        action: 'created',
        location: emptyMeta,
        status,
        note: note.trim() || null,
        created_by: staff.id,
      });

      setSaving(false);
      router.replace(`/staff/demirbaslar/${asset.id}`);
    } catch (e) {
      setSaving(false);
      Alert.alert('Hata', (e as Error).message || 'Fotoğraflar yüklenemedi.');
    }
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FieldLabel text="Demirbaş adı *" />
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Örn: klima" />

      <FieldLabel text="Durum *" />
      <StatusRow value={status} onChange={setStatus} />

      <FieldLabel text="Adet" />
      <TextInput style={styles.input} keyboardType="numeric" value={quantity} onChangeText={setQuantity} />

      <FieldLabel text="Marka / Model" />
      <TextInput style={styles.input} value={brandModel} onChangeText={setBrandModel} />

      <FieldLabel text="Seri No" />
      <TextInput style={styles.input} value={serialNo} onChangeText={setSerialNo} />

      <FieldLabel text="Not" />
      <TextInput style={[styles.input, styles.area]} value={note} onChangeText={setNote} multiline numberOfLines={3} />

      <FieldLabel text="Fotoğraf * (en az 1)" />
      <View style={styles.photoActions}>
        <TouchableOpacity style={[styles.photoBtn, styles.photoBtnCamera]} onPress={takePhoto} disabled={saving}>
          <Text style={styles.photoBtnText}>Kameradan çek</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.photoBtn, styles.photoBtnGallery]} onPress={pickPhotos} disabled={saving}>
          <Text style={styles.photoBtnText}>Galeriden seç</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.photosWrap}>
        {photos.map((p) => (
          <TouchableOpacity key={p} activeOpacity={0.9} onPress={() => setPreviewUri(p)}>
            <CachedImage uri={p} style={styles.photo} contentFit="cover" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}>
        <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Text>
      </TouchableOpacity>
    </ScrollView>
    <ImagePreviewModal visible={!!previewUri} uri={previewUri} onClose={() => setPreviewUri(null)} />
    </>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function StatusRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectRow}>
      {FIXED_ASSET_STATUSES.map((s) => (
        <TouchableOpacity
          key={s.value}
          style={[styles.chip, value === s.value && styles.chipActive]}
          onPress={() => onChange(s.value)}
        >
          <Text style={[styles.chipText, value === s.value && styles.chipTextActive]} numberOfLines={1}>
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 6, marginTop: 10, letterSpacing: 0.3 },
  input: { borderWidth: 1, borderColor: theme.colors.borderLight, borderRadius: 10, padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text },
  area: { minHeight: 80, textAlignVertical: 'top' },
  selectRow: { gap: 6, paddingBottom: 2, flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    maxWidth: 220,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  photoBtnCamera: { backgroundColor: '#0284c7' },
  photoBtnGallery: { backgroundColor: theme.colors.primary },
  photoBtnText: { color: '#fff', fontWeight: '700' },
  photosWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  photo: { width: 100, height: 100, borderRadius: 12, backgroundColor: theme.colors.borderLight },
  saveBtn: { marginTop: 20, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});
