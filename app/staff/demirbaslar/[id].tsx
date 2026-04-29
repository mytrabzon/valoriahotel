import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { CachedImage } from '@/components/CachedImage';
import { ImagePreviewModal } from '@/components/ImagePreviewModal';
import { theme } from '@/constants/theme';
import { fixedAssetStatusLabel } from '@/lib/fixedAssets';
import { useAuthStore } from '@/stores/authStore';

type AssetDetail = {
  id: string;
  category: string;
  name: string;
  location: string;
  status: string;
  quantity: number;
  note: string | null;
  brand_model: string | null;
  serial_no: string | null;
  created_at: string;
  updated_at: string;
  adder: { full_name: string | null } | null;
  updater: { full_name: string | null } | null;
  photos: { id: string; photo_url: string }[];
};

type HistoryRow = {
  id: string;
  action: 'created' | 'updated';
  location: string;
  status: string;
  note: string | null;
  created_at: string;
  actor: { full_name: string | null } | null;
};

export default function FixedAssetDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { staff } = useAuthStore();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('fixed_assets')
      .select(
        'id, category, name, location, status, quantity, note, brand_model, serial_no, created_at, updated_at, adder:added_by(full_name), updater:last_updated_by(full_name), photos:fixed_asset_photos(id, photo_url)'
      )
      .eq('id', id)
      .single()
      .then(({ data }) => setAsset((data as AssetDetail) ?? null));

    supabase
      .from('fixed_asset_history')
      .select('id, action, location, status, note, created_at, actor:created_by(full_name)')
      .eq('asset_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistory((data as HistoryRow[]) ?? []));
  }, [id]);

  if (!asset) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Yükleniyor…</Text>
      </View>
    );
  }

  const cat = (asset.category ?? '').trim();
  const loc = (asset.location ?? '').trim();
  const metaCatLoc = [cat, loc].filter(Boolean).join(' · ');
  const canDelete = staff?.role === 'admin';

  const handleDelete = () => {
    if (!id || !canDelete || deleting) return;
    Alert.alert('Demirbaşı sil', 'Bu kayıt kalıcı olarak silinecek. Devam etmek istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          const { error } = await supabase.from('fixed_assets').delete().eq('id', id);
          setDeleting(false);
          if (error) {
            Alert.alert('Hata', error.message || 'Kayıt silinemedi.');
            return;
          }
          router.replace('/staff/demirbaslar');
        },
      },
    ]);
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{asset.name}</Text>
      {metaCatLoc ? <Text style={styles.metaLine}>{metaCatLoc}</Text> : null}
      <Text style={styles.metaLine}>
        Durum: {fixedAssetStatusLabel(asset.status)} · Adet: {asset.quantity}
      </Text>
      <Text style={styles.metaLine}>Ekleyen: {asset.adder?.full_name ?? '—'}</Text>
      <Text style={styles.metaLine}>Son güncelleyen: {asset.updater?.full_name ?? '—'}</Text>
      <Text style={styles.metaMuted}>
        Eklenme: {new Date(asset.created_at).toLocaleString('tr-TR')} · Güncelleme:{' '}
        {new Date(asset.updated_at).toLocaleString('tr-TR')}
      </Text>
      {asset.brand_model ? <Text style={styles.metaLine}>Marka / model: {asset.brand_model}</Text> : null}
      {asset.serial_no ? <Text style={styles.metaLine}>Seri no: {asset.serial_no}</Text> : null}
      {asset.note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{asset.note}</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Fotoğraflar</Text>
      <View style={styles.photos}>
        {asset.photos?.map((p) => (
          <TouchableOpacity key={p.id} activeOpacity={0.9} onPress={() => setPreviewUri(p.photo_url)}>
            <CachedImage uri={p.photo_url} style={styles.photo} contentFit="cover" />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.section}>Kayıt geçmişi</Text>
      <View style={styles.history}>
        {history.length === 0 ? (
          <Text style={styles.metaMuted}>Henüz geçmiş yok.</Text>
        ) : (
          history.map((h) => (
            <View key={h.id} style={styles.historyRow}>
              <Text style={styles.historyText}>
                {new Date(h.created_at).toLocaleString('tr-TR')} · {h.actor?.full_name ?? '—'} ·{' '}
                {h.action === 'created' ? 'Eklendi' : 'Güncellendi'}
              </Text>
              <Text style={styles.historyMeta}>
                {(h.location || '').trim() ? `${h.location.trim()} · ` : ''}
                {fixedAssetStatusLabel(h.status)}
              </Text>
              {h.note ? <Text style={styles.historyMeta}>{h.note}</Text> : null}
            </View>
          ))
        )}
      </View>

      {canDelete ? (
        <TouchableOpacity
          style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
          onPress={handleDelete}
          activeOpacity={0.88}
          disabled={deleting}
        >
          <Text style={styles.deleteBtnText}>{deleting ? 'Siliniyor…' : 'Demirbaşı Sil'}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
    <ImagePreviewModal visible={!!previewUri} uri={previewUri} onClose={() => setPreviewUri(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  section: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginTop: 20,
    marginBottom: 8,
  },
  metaLine: { fontSize: 14, color: theme.colors.text, marginTop: 6 },
  metaMuted: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8, lineHeight: 18 },
  noteBox: {
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  noteText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: 120, height: 120, borderRadius: 12, backgroundColor: theme.colors.borderLight },
  history: { gap: 8 },
  historyRow: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 12,
    padding: 12,
  },
  historyText: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  historyMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4, lineHeight: 16 },
  muted: { color: theme.colors.textMuted, fontSize: 15 },
  deleteBtn: {
    marginTop: 18,
    backgroundColor: theme.colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnDisabled: { opacity: 0.7 },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
