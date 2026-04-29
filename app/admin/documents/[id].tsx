import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation, usePathname } from 'expo-router';
import { WebView } from 'react-native-webview';
import { adminTheme } from '@/constants/adminTheme';
import { supabase } from '@/lib/supabase';
import { getDocumentWithVersions, type DocumentRow, type DocumentVersionRow } from '@/lib/documentManagement';
import { useAuthStore } from '@/stores/authStore';
import { CachedImage } from '@/components/CachedImage';
import { getDocumentsBucketPublicUrl, isDocumentImageMime } from '@/lib/documentsSignedUrl';

export default function AdminDocumentDetail() {
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname() ?? '';
  const { width, height: winH } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const staff = useAuthStore((s) => s.staff);
  const docId = id ?? '';
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [versions, setVersions] = useState<DocumentVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    const { docRes, versionsRes } = await getDocumentWithVersions(docId);
    if (!docRes.error && docRes.data) setDoc(docRes.data as any);
    if (versionsRes && !versionsRes.error && versionsRes.data) setVersions(versionsRes.data as any);
    setLoading(false);
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  const canHardDelete = staff?.role === 'admin';

  const currentVersion = useMemo(() => versions.find((v) => v.id === doc?.current_version_id) ?? null, [versions, doc?.current_version_id]);

  const uploaderDisplayName = useMemo(() => {
    if (!doc?.uploader) return null;
    const u = doc.uploader;
    if (Array.isArray(u)) {
      const n = u[0]?.full_name;
      return typeof n === 'string' && n.trim() ? n.trim() : null;
    }
    const n = u.full_name;
    return typeof n === 'string' && n.trim() ? n.trim() : null;
  }, [doc]);

  const isArchived = useMemo(() => doc?.archived_at != null, [doc?.archived_at]);

  const isImage = useMemo(
    () =>
      currentVersion
        ? isDocumentImageMime(currentVersion.mime_type, currentVersion.file_name, currentVersion.file_path)
        : false,
    [currentVersion]
  );

  const previewUrl = useMemo(
    () => (currentVersion?.file_path ? getDocumentsBucketPublicUrl(currentVersion.file_path) : null),
    [currentVersion?.file_path]
  );

  const archive = async () => {
    if (!docId) return;
    const now = new Date().toISOString();
    const res = await supabase.from('documents').update({ status: 'archived', archived_at: now }).eq('id', docId);
    if (res.error) return Alert.alert('Hata', res.error.message);
    await supabase.from('document_logs').insert({
      organization_id: staff?.organization_id,
      document_id: docId,
      actor_staff_id: staff?.id,
      action_type: 'document.archived',
      new_data: { archived_at: now },
    });
    await load();
  };

  const unarchive = async () => {
    if (!docId) return;
    Alert.alert('Arşivden çıkar', 'Bu belge tekrar “Tüm belgeler” listesine alınsın mı?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Evet',
        onPress: async () => {
          const res = await supabase
            .from('documents')
            .update({ status: 'active', archived_at: null })
            .eq('id', docId);
          if (res.error) return Alert.alert('Hata', res.error.message);
          await supabase.from('document_logs').insert({
            organization_id: staff?.organization_id,
            document_id: docId,
            actor_staff_id: staff?.id,
            action_type: 'document.unarchived',
            new_data: { previous_archived_at: doc?.archived_at },
          });
          await load();
        },
      },
    ]);
  };

  const hardDelete = async () => {
    if (!docId) return;
    if (!canHardDelete) return Alert.alert('Yetki yok', 'Silme yetkisi sadece admin.');
    Alert.alert('Kalıcı sil', 'Belge ve tüm versiyonları kalıcı silinecek. Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const logRes = await supabase.from('document_logs').insert({
            organization_id: staff?.organization_id,
            document_id: docId,
            actor_staff_id: staff?.id,
            action_type: 'document.deleted',
            old_data: doc,
          });
          if (logRes.error) {
            // if log insert fails, still try delete
          }
          const res = await supabase.from('documents').delete().eq('id', docId);
          if (res.error) return Alert.alert('Hata', res.error.message);
          if (navigation.canGoBack()) router.back();
          else {
            const list = pathname.includes('/staff/') ? '/staff/documents/all' : '/admin/documents/all';
            router.replace(list as never);
          }
        },
      },
    ]);
  };

  /** Görsel: daha yüksek; PDF ve diğer dosyalar: WebView alanı (uygulama içi) */
  const previewHeightImage = Math.min(Math.round(winH * 0.45), 520);
  const previewHeightDoc = Math.min(420, Math.round(width * 0.95));

  return (
    <View style={styles.container}>
      {!docId ? (
        <Text style={[styles.sub, styles.bodyPad]}>Belge bulunamadı</Text>
      ) : loading && !doc ? (
        <Text style={[styles.sub, styles.bodyPad]}>Yükleniyor…</Text>
      ) : !doc ? (
        <Text style={[styles.sub, styles.bodyPad]}>Belge bulunamadı</Text>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{doc.title}</Text>
          <Text style={styles.sub}>
            Yükleyen: {uploaderDisplayName ?? '—'}
          </Text>
          <Text style={styles.sub}>Durum: {doc.status}{isArchived ? ' (arşivde)' : ''}</Text>
          <Text style={styles.sub}>Oluşturma: {new Date(doc.created_at).toLocaleString('tr-TR')}</Text>
          <Text style={styles.sub}>Güncelleme: {new Date(doc.updated_at).toLocaleString('tr-TR')}</Text>
          {doc.expiry_date ? <Text style={styles.sub}>Son geçerlilik: {doc.expiry_date}</Text> : null}
          {doc.rejected_reason ? <Text style={[styles.sub, { color: adminTheme.colors.error }]}>Red nedeni: {doc.rejected_reason}</Text> : null}

          {currentVersion ? (
            <View style={styles.previewCard}>
              <Text style={styles.sectionTitle}>Önizleme</Text>
              {!previewUrl ? (
                <Text style={styles.sub}>
                  Önizleme adresi oluşturulamadı (dosya yolu eksik). Bucket public değilse yöneticiye bildirin.
                </Text>
              ) : isImage ? (
                <CachedImage
                  uri={previewUrl}
                  style={[styles.previewImage, { maxHeight: previewHeightImage, minHeight: 200 }]}
                  contentFit="contain"
                />
              ) : (
                <View style={[styles.pdfFrame, { height: previewHeightDoc }]}>
                  <WebView source={{ uri: previewUrl }} style={styles.webview} nestedScrollEnabled />
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            {isArchived ? (
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRestore]} onPress={unarchive} activeOpacity={0.85}>
                <Text style={styles.actionText}>Arşivden çıkar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnWarn]} onPress={archive} activeOpacity={0.85}>
                <Text style={styles.actionText}>Arşivle</Text>
              </TouchableOpacity>
            )}
            {canHardDelete ? (
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={hardDelete} activeOpacity={0.85}>
                <Text style={styles.actionText}>Sil</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Versiyonlar</Text>
          <FlatList
            data={versions}
            keyExtractor={(v) => v.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.verRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.verTitle} numberOfLines={1}>
                    v{item.version_no} · {item.file_name}
                  </Text>
                  <Text style={styles.verMeta} numberOfLines={2}>
                    {new Date(item.created_at).toLocaleString('tr-TR')}
                    {item.note ? ` · ${item.note}` : ''}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.sub}>Versiyon yok</Text>}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  scroll: { flex: 1 },
  bodyPad: { paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, paddingTop: 4, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '900', color: adminTheme.colors.text },
  sub: { marginTop: 8, fontSize: 13, fontWeight: '600', color: adminTheme.colors.textMuted, lineHeight: 18 },
  previewCard: {
    marginTop: 16,
    padding: 14,
    backgroundColor: adminTheme.colors.surface,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
  },
  previewImage: {
    width: '100%',
    marginTop: 8,
    borderRadius: adminTheme.radius.md,
    backgroundColor: adminTheme.colors.surfaceSecondary,
  },
  pdfFrame: {
    marginTop: 8,
    borderRadius: adminTheme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: adminTheme.colors.borderLight,
    backgroundColor: '#fff',
  },
  webview: { flex: 1, backgroundColor: '#fff' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 10 },
  actionBtn: { backgroundColor: adminTheme.colors.primary, borderRadius: adminTheme.radius.lg, paddingVertical: 12, paddingHorizontal: 14 },
  actionBtnWarn: { backgroundColor: adminTheme.colors.warning },
  actionBtnRestore: { backgroundColor: adminTheme.colors.success },
  actionBtnDanger: { backgroundColor: adminTheme.colors.error },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  sectionTitle: { marginTop: 12, marginBottom: 8, fontSize: 14, fontWeight: '900', color: adminTheme.colors.text },
  verRow: { backgroundColor: adminTheme.colors.surface, borderRadius: adminTheme.radius.lg, borderWidth: 1, borderColor: adminTheme.colors.border, padding: 12, marginBottom: 10 },
  verTitle: { fontSize: 14, fontWeight: '800', color: adminTheme.colors.text },
  verMeta: { marginTop: 4, fontSize: 12, fontWeight: '600', color: adminTheme.colors.textMuted, lineHeight: 16 },
});
