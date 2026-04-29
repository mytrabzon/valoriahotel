import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { adminTheme } from '@/constants/adminTheme';
import { CachedImage } from '@/components/CachedImage';
import { uploadLocalAreaGuideImage } from '@/lib/localAreaGuideUpload';
import { ensureMediaLibraryPermission } from '@/lib/mediaLibraryPermission';

type Row = {
  id: string;
  title: string;
  body: string | null;
  image_urls: string[];
  is_published: boolean;
  sort_order: number;
};

export default function AdminLocalAreaGuideEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { staff } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.from('local_area_guide_entries').select('*').eq('id', id).maybeSingle();
    setLoading(false);
    if (error || !data) {
      Alert.alert(t('error'), error?.message ?? 'not found');
      router.back();
      return;
    }
    const r = data as Row;
    setTitle(r.title ?? '');
    setBody(r.body ?? '');
    setImageUrls(Array.isArray(r.image_urls) ? r.image_urls : []);
    setIsPublished(!!r.is_published);
    setSortOrder(String(r.sort_order ?? 0));
  }, [id, router, t]);

  useEffect(() => {
    load();
  }, [load]);

  const pickImages = async () => {
    if (!staff?.organization_id || !id) return;
    const ok = await ensureMediaLibraryPermission({
      title: t('permission'),
      message: t('galleryRequired'),
      settingsMessage: t('galleryRequired'),
    });
    if (!ok) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.75,
    });
    if (res.canceled || !res.assets?.length) return;
    setSaving(true);
    try {
      const uploaded: string[] = [];
      for (const a of res.assets) {
        if (!a.uri) continue;
        const url = await uploadLocalAreaGuideImage({
          organizationId: staff.organization_id,
          entryId: id,
          localUri: a.uri,
          fileName: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`,
        });
        uploaded.push(url);
      }
      setImageUrls((prev) => [...prev, ...uploaded]);
    } catch (e) {
      Alert.alert(t('error'), (e as Error)?.message ?? 'upload');
    } finally {
      setSaving(false);
    }
  };

  const removeImageAt = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!id || !title.trim()) {
      Alert.alert(t('error'), t('localAreaGuideTitleRequired'));
      return;
    }
    const so = parseInt(sortOrder.replace(/\D/g, '') || '0', 10);
    setSaving(true);
    const { error } = await supabase
      .from('local_area_guide_entries')
      .update({
        title: title.trim(),
        body: body.trim() || null,
        image_urls: imageUrls,
        is_published: isPublished,
        sort_order: Number.isFinite(so) ? so : 0,
      })
      .eq('id', id);
    setSaving(false);
    if (error) {
      Alert.alert(t('error'), error.message);
      return;
    }
    Alert.alert('', t('localAreaGuideSaved'));
    router.back();
  };

  const removeEntry = () => {
    if (!id) return;
    Alert.alert(t('localAreaGuideDelete'), t('localAreaGuideDeleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('localAreaGuideDelete'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('local_area_guide_entries').delete().eq('id', id);
          if (error) {
            Alert.alert(t('error'), error.message);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  if (loading || !id) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={adminTheme.colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>{t('localAreaGuideFieldTitle')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t('localAreaGuideFieldTitle')}
      />

      <Text style={styles.label}>{t('localAreaGuideFieldBody')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={body}
        onChangeText={setBody}
        placeholder={t('localAreaGuideBodyPlaceholder')}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.rowBetween}>
        <Text style={styles.label}>{t('localAreaGuideFieldPublished')}</Text>
        <Switch value={isPublished} onValueChange={setIsPublished} />
      </View>

      <Text style={styles.label}>{t('localAreaGuideFieldSort')}</Text>
      <TextInput
        style={styles.input}
        value={sortOrder}
        onChangeText={setSortOrder}
        keyboardType="number-pad"
      />

      <View style={styles.rowBetween}>
        <Text style={styles.label}>{t('localAreaGuideImagesSection')}</Text>
        <TouchableOpacity style={styles.addImgBtn} onPress={pickImages} disabled={saving}>
          <Ionicons name="images-outline" size={20} color={adminTheme.colors.accent} />
          <Text style={styles.addImgText}>{t('localAreaGuideAddPhotos')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.imgGrid}>
        {imageUrls.map((uri, idx) => (
          <View key={`${uri}-${idx}`} style={styles.imgCell}>
            <CachedImage uri={uri} style={styles.img} contentFit="cover" />
            <TouchableOpacity style={styles.imgRemove} onPress={() => removeImageAt(idx)}>
              <Ionicons name="close-circle" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('localAreaGuideSave')}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.dangerBtn} onPress={removeEntry}>
        <Text style={styles.dangerBtnText}>{t('localAreaGuideDelete')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: adminTheme.colors.background },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: adminTheme.colors.background },
  label: { fontSize: 13, fontWeight: '600', color: adminTheme.colors.textMuted, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: adminTheme.colors.text,
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 140 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  addImgBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addImgText: { color: adminTheme.colors.accent, fontWeight: '600' },
  imgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  imgCell: { width: 100, height: 100, borderRadius: 10, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  imgRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
  },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: adminTheme.colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dangerBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { color: '#b91c1c', fontWeight: '600', fontSize: 15 },
});
