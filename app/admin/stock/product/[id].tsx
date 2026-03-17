import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { adminTheme } from '@/constants/adminTheme';
import { AdminButton, AdminCard } from '@/components/admin';
import { CachedImage } from '@/components/CachedImage';
import { ImagePreviewModal } from '@/components/ImagePreviewModal';
import { formatDateTime } from '@/lib/date';

type Product = {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  unit: string | null;
  min_stock: number | null;
  max_stock: number | null;
  current_stock: number | null;
  image_url: string | null;
  purchase_price: number | null;
  selling_price: number | null;
  created_at: string;
  updated_at: string | null;
  category_id: string | null;
  created_by: string | null;
  category: { id: string; name: string } | null;
  creator: { full_name: string | null } | null;
};

type Movement = {
  id: string;
  movement_type: string;
  quantity: number;
  status: string;
  notes: string | null;
  location: string | null;
  staff_image: string | null;
  photo_proof: string | null;
  created_at: string;
  approved_at: string | null;
  staff: { full_name: string | null } | null;
  approver: { full_name: string | null } | null;
};

export default function StockProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    const { data: prod, error: prodErr } = await supabase
      .from('stock_products')
      .select(
        'id, name, description, barcode, unit, min_stock, max_stock, current_stock, image_url, purchase_price, selling_price, created_at, updated_at, category_id, created_by, category:stock_categories(id, name), creator:created_by(full_name)'
      )
      .eq('id', id)
      .single();
    if (prodErr || !prod) {
      setProduct(null);
      setLoading(false);
      return;
    }
    setProduct(prod as unknown as Product);

    const { data: mov } = await supabase
      .from('stock_movements')
      .select(
        'id, movement_type, quantity, status, notes, location, staff_image, photo_proof, created_at, approved_at, staff:staff_id(full_name), approver:approved_by(full_name)'
      )
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(20);
    setMovements((mov ?? []) as Movement[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading && !product) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={adminTheme.colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Ürün bulunamadı</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cur = product.current_stock ?? 0;
  const min = product.min_stock ?? 0;
  const max = product.max_stock ?? 1;
  const pct = max > 0 ? Math.min((cur / max) * 100, 100) : 0;
  const isLow = min > 0 && cur <= min;

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminTheme.colors.primary} />}
    >
      {/* Başlık + stok özeti */}
      <AdminCard>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setPreviewUri(product.image_url || 'https://via.placeholder.com/120')} activeOpacity={0.8}>
            <CachedImage uri={product.image_url || 'https://via.placeholder.com/120'} style={styles.mainImage} contentFit="cover" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.categoryName}>{product.category?.name ?? 'Kategorisiz'}</Text>
            <View style={[styles.stockBadge, isLow && styles.stockBadgeLow]}>
              <Text style={styles.stockBadgeText}>
                Stok: {cur} {product.unit ?? 'adet'}
                {isLow ? ' (Kritik)' : ''}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.barBg}>
          <View style={[styles.barFill, isLow ? styles.barRed : styles.barGreen, { width: `${pct}%` }]} />
        </View>
        {product.max_stock != null && (
          <Text style={styles.barLabel}>
            Min: {product.min_stock ?? 0} · Max: {product.max_stock}
          </Text>
        )}
      </AdminCard>

      {/* Ürün bilgileri */}
      <Text style={styles.blockLabel}>📦 ÜRÜN BİLGİLERİ</Text>
      <AdminCard>
        <Row label="Barkod" value={product.barcode ?? '—'} />
        <Row label="Kategori" value={product.category?.name ?? '—'} />
        <Row label="Birim" value={product.unit ?? 'adet'} />
        <Row label="Alış fiyatı" value={product.purchase_price != null ? `${product.purchase_price} ₺` : '—'} />
        <Row label="Satış fiyatı" value={product.selling_price != null ? `${product.selling_price} ₺` : '—'} />
        {min > 0 ? <Row label="Kritik stok (min)" value={String(min)} /> : null}
        {(product.description ?? '').trim() ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Açıklama</Text>
            <Text style={styles.rowValue}>{product.description}</Text>
          </View>
        ) : null}
        <Row label="Ekleyen" value={product.creator?.full_name ?? '—'} />
        <Row label="Eklenme" value={formatDateTime(product.created_at)} />
        {product.updated_at ? (
          <Row label="Son güncelleme" value={formatDateTime(product.updated_at)} />
        ) : null}
      </AdminCard>

      {/* Ürün fotoğrafı */}
      <Text style={styles.blockLabel}>📸 ÜRÜN FOTOĞRAFI</Text>
      <AdminCard>
        <View style={styles.photoBlock}>
          {product.image_url ? (
            <TouchableOpacity onPress={() => setPreviewUri(product.image_url)} activeOpacity={0.8}>
              <CachedImage uri={product.image_url} style={styles.photoLarge} contentFit="contain" />
            </TouchableOpacity>
          ) : null}
          {!product.image_url && (
            <Text style={styles.photoPlaceholder}>Fotoğraf yok</Text>
          )}
        </View>
      </AdminCard>

      {/* Stok hareketleri */}
      <View style={styles.sectionRow}>
        <Text style={styles.blockLabel}>📊 STOK HAREKETLERİ (Son {movements.length})</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: '/admin/stock/movement', params: { productId: id } })}>
          <Text style={styles.sectionLink}>Giriş / Çıkış</Text>
        </TouchableOpacity>
      </View>
      <AdminCard>
        {movements.length === 0 ? (
          <Text style={styles.emptyText}>Henüz hareket yok</Text>
        ) : (
          movements.map((m) => (
            <View key={m.id} style={styles.movRow}>
              <View style={[styles.movIcon, m.movement_type === 'in' ? styles.movIn : styles.movOut]}>
                <Ionicons name={m.movement_type === 'in' ? 'arrow-down' : 'arrow-up'} size={16} color="#fff" />
              </View>
              <View style={styles.movBody}>
                <Text style={styles.movText}>
                  {m.movement_type === 'in' ? '📥 GİRİŞ' : '📤 ÇIKIŞ'} — {m.movement_type === 'in' ? '+' : '-'}{m.quantity} {product.unit ?? 'adet'}
                </Text>
                <Text style={styles.movMeta}>
                  {formatDateTime(m.created_at)} · 👤 {(m.staff as { full_name?: string })?.full_name ?? '—'}
                </Text>
                {m.location ? (
                  <Text style={styles.movLocation}>📍 {m.location}</Text>
                ) : null}
                {m.notes ? <Text style={styles.movNotes}>📝 "{m.notes}"</Text> : null}
                <View style={styles.movThumbs}>
                  {m.staff_image ? (
                    <TouchableOpacity onPress={() => setPreviewUri(m.staff_image)} activeOpacity={0.8}>
                      <CachedImage uri={m.staff_image} style={styles.movThumb} contentFit="cover" />
                    </TouchableOpacity>
                  ) : null}
                  {m.photo_proof ? (
                    <TouchableOpacity onPress={() => setPreviewUri(m.photo_proof)} activeOpacity={0.8}>
                      <CachedImage uri={m.photo_proof} style={styles.movThumb} contentFit="cover" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.movStatus}>
                  {m.status === 'approved' ? 'Onaylı' : m.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                  {m.approved_at && (m.approver as { full_name?: string })?.full_name
                    ? ` (${(m.approver as { full_name: string }).full_name})`
                    : ''}
                </Text>
              </View>
            </View>
          ))
        )}
      </AdminCard>

      <View style={styles.actions}>
        <AdminButton
          title="Stok giriş/çıkış"
          onPress={() => router.push({ pathname: '/admin/stock/movement', params: { productId: id } })}
          variant="accent"
          size="md"
          leftIcon={<Ionicons name="swap-vertical" size={20} color="#fff" />}
          fullWidth
        />
      </View>
      <View style={styles.bottomSpacer} />
    </ScrollView>
    <ImagePreviewModal visible={!!previewUri} uri={previewUri} onClose={() => setPreviewUri(null)} />
  </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15, color: adminTheme.colors.textSecondary },
  errorText: { fontSize: 16, color: adminTheme.colors.error },
  backBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: adminTheme.colors.border },
  backBtnText: { fontSize: 15, fontWeight: '600', color: adminTheme.colors.text },
  headerRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  mainImage: { width: 100, height: 100, borderRadius: 12, backgroundColor: adminTheme.colors.borderLight },
  headerInfo: { flex: 1, minWidth: 0 },
  productName: { fontSize: 20, fontWeight: '700', color: adminTheme.colors.text },
  categoryName: { fontSize: 14, color: adminTheme.colors.textSecondary, marginTop: 4 },
  stockBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: adminTheme.colors.success,
  },
  stockBadgeLow: { backgroundColor: adminTheme.colors.error },
  stockBadgeText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  barBg: { height: 8, backgroundColor: adminTheme.colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barGreen: { backgroundColor: adminTheme.colors.success },
  barRed: { backgroundColor: adminTheme.colors.error },
  barLabel: { fontSize: 12, color: adminTheme.colors.textMuted, marginTop: 6 },
  blockLabel: { fontSize: 14, fontWeight: '700', color: adminTheme.colors.textSecondary, marginBottom: 8, marginTop: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: adminTheme.colors.text, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 16 },
  sectionLink: { fontSize: 14, fontWeight: '600', color: adminTheme.colors.accent },
  row: { marginBottom: 10 },
  rowLabel: { fontSize: 13, color: adminTheme.colors.textMuted, marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '500', color: adminTheme.colors.text },
  emptyText: { fontSize: 14, color: adminTheme.colors.textMuted },
  photoBlock: { minHeight: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: adminTheme.colors.surfaceTertiary, borderRadius: 12 },
  photoLarge: { width: '100%', height: 200, borderRadius: 12 },
  photoPlaceholder: { fontSize: 14, color: adminTheme.colors.textMuted, padding: 20 },
  movRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: adminTheme.colors.borderLight,
    gap: 12,
  },
  movIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  movIn: { backgroundColor: adminTheme.colors.success },
  movOut: { backgroundColor: adminTheme.colors.error },
  movBody: { flex: 1, minWidth: 0 },
  movText: { fontSize: 15, fontWeight: '600', color: adminTheme.colors.text },
  movMeta: { fontSize: 12, color: adminTheme.colors.textMuted, marginTop: 2 },
  movNotes: { fontSize: 13, color: adminTheme.colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  movLocation: { fontSize: 12, color: adminTheme.colors.textMuted, marginTop: 2 },
  movThumbs: { flexDirection: 'row', gap: 8, marginTop: 6 },
  movThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: adminTheme.colors.borderLight },
  movStatus: { fontSize: 11, color: adminTheme.colors.textMuted, marginTop: 4 },
  actions: { marginTop: 20 },
  bottomSpacer: { height: 24 },
});
