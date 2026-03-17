import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { adminTheme } from '@/constants/adminTheme';
import { CachedImage } from '@/components/CachedImage';
import { ImagePreviewModal } from '@/components/ImagePreviewModal';

function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month} ${h}:${min}`;
}

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  unit: string | null;
  current_stock: number | null;
  min_stock: number | null;
  max_stock: number | null;
  image_url: string | null;
  category: Category | null;
};
type Alert = { id: string; message: string | null; product_id: string; product?: { name: string } };
type LastMovement = { staffName: string; createdAt: string };

export default function StockManagement() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastMovementByProduct, setLastMovementByProduct] = useState<Record<string, LastMovement>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const loadData = async () => {
    setLoadError(null);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('stock_products')
        .select('id, name, barcode, unit, current_stock, min_stock, max_stock, image_url, category_id, category:stock_categories(id, name)')
        .order('name');
      if (productsError) {
        setLoadError(productsError.message || 'Ürünler yüklenemedi');
        setProducts([]);
      } else {
        setProducts(productsData ?? []);
      }

      const { data: categoriesData } = await supabase.from('stock_categories').select('id, name').order('name');
      setCategories(categoriesData ?? []);

      try {
        const { data: alertsData } = await supabase
          .from('stock_alerts')
          .select('id, message, product_id, product:stock_products(name)')
          .eq('is_resolved', false);
        setAlerts(alertsData ?? []);
      } catch {
        setAlerts([]);
      }

      try {
        const { data: movementsData } = await supabase
          .from('stock_movements')
          .select('product_id, created_at, staff:staff_id(full_name)')
          .order('created_at', { ascending: false });
        const byProduct: Record<string, LastMovement> = {};
        for (const m of movementsData ?? []) {
          const pid = (m as { product_id: string }).product_id;
          if (pid && !byProduct[pid]) {
            const staff = (m as { staff?: { full_name: string | null } }).staff;
            byProduct[pid] = {
              staffName: staff?.full_name ?? '—',
              createdAt: (m as { created_at: string }).created_at,
            };
          }
        }
        setLastMovementByProduct(byProduct);
      } catch {
        setLastMovementByProduct({});
      }
    } catch (e) {
      setLoadError((e as Error)?.message ?? 'Veri yüklenirken hata oluştu');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.barcode != null && p.barcode.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const headerPaddingTop = Platform.OS === 'ios' ? insets.top : insets.top + 8;
  const footerPaddingBottom = insets.bottom + 20;

  return (
    <View style={styles.container}>
      {/* Özel header: Stok Yönetimi + arama */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBack}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityLabel="Geri"
          >
            <Ionicons name="arrow-back" size={24} color={adminTheme.colors.surface} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Stok Yönetimi</Text>
            <Text style={styles.headerSub}>
              {products.length} ürün · {alerts.length > 0 ? `${alerts.length} uyarı` : 'Uyarı yok'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => router.push('/admin')}
            activeOpacity={0.8}
          >
            <Ionicons name="home-outline" size={22} color={adminTheme.colors.surface} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={adminTheme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.search}
            placeholder="Ürün adı veya barkod ara..."
            placeholderTextColor={adminTheme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={12} style={styles.searchClear}>
              <Ionicons name="close-circle" size={20} color={adminTheme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Kritik uyarılar */}
      {alerts.length > 0 && (
        <View style={styles.alertBanner}>
          <View style={styles.alertBannerLeft}>
            <Ionicons name="warning" size={22} color="#fff" />
            <Text style={styles.alertBannerTitle}>Kritik stok ({alerts.length})</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.alertScroll}>
            {alerts.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.alertChip}
                onPress={() => router.push({ pathname: '/admin/stock/movement', params: { productId: a.product_id } })}
                activeOpacity={0.8}
              >
                <Text style={styles.alertChipText} numberOfLines={1}>
                  {(a.product as { name?: string })?.name ?? a.product_id}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Kategori filtreleri */}
      <ScrollView
        horizontal
        style={styles.categoriesWrap}
        contentContainerStyle={styles.categoriesContent}
        showsHorizontalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[styles.chip, selectedCategory === 'all' && styles.chipActive]}
          onPress={() => setSelectedCategory('all')}
          activeOpacity={0.8}
        >
          <Text style={[styles.chipText, selectedCategory === 'all' && styles.chipTextActive]}>Tümü</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, selectedCategory === c.id && styles.chipActive]}
            onPress={() => setSelectedCategory(c.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, selectedCategory === c.id && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste alanı: bölüm başlığı + liste (aşağı kaydırın, alt butonlar en altta sabit) */}
        <View style={styles.listWrapper}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 TÜM ÜRÜNLER ({filtered.length})</Text>
          </View>
          <Text style={styles.sectionHint}>Yeni Ürün · Stok Girişi · Stok Çıkışı butonları en altta</Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={adminTheme.colors.primary} />
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.empty}>
              <Ionicons name="alert-circle-outline" size={56} color={adminTheme.colors.error} />
              <Text style={styles.emptyTitle}>Yükleme hatası</Text>
              <Text style={styles.emptySub}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); loadData(); }} activeOpacity={0.8}>
                <Text style={styles.retryBtnText}>Tekrar dene</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingBottom: 140 + footerPaddingBottom }]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[adminTheme.colors.accent]} />}
          >
            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={56} color={adminTheme.colors.textMuted} />
                <Text style={styles.emptyTitle}>
                  {products.length === 0 ? 'Henüz ürün yok' : 'Bu arama/kategoriye uygun ürün yok'}
                </Text>
                <Text style={styles.emptySub}>
                  {products.length === 0
                    ? 'Yeni Ürün veya Stok Girişi ile ürün ekleyebilirsiniz.'
                    : 'Arama kutusunu temizleyin veya "Tümü" kategorisini seçin.'}
                </Text>
                {search.length > 0 && (
                  <TouchableOpacity style={styles.retryBtn} onPress={() => setSearch('')} activeOpacity={0.8}>
                    <Text style={styles.retryBtnText}>Aramayı temizle</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
            filtered.map((p) => {
              const cur = p.current_stock ?? 0;
              const min = p.min_stock ?? 0;
              const max = p.max_stock ?? 1;
              const pct = max > 0 ? Math.min((cur / max) * 100, 100) : 0;
              const isLow = min > 0 && cur <= min;
              const last = lastMovementByProduct[p.id];
              const lastLine = last
                ? `Son giriş: ${last.staffName} (${formatShortDateTime(last.createdAt)})`
                : 'Son giriş: —';
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.card, isLow && styles.cardLow]}
                  onPress={() => router.push(`/admin/stock/product/${p.id}`)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name} detayı`}
                >
                  <CachedImage
                    uri={p.image_url || 'https://via.placeholder.com/72'}
                    style={styles.cardImage}
                    contentFit="cover"
                  />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{p.name}</Text>
                    {p.barcode ? (
                      <Text style={styles.cardBarcode} numberOfLines={1}>Barkod: {p.barcode}</Text>
                    ) : null}
                    <Text style={styles.cardMetaLine}>
                      Stok: <Text style={[styles.stockHighlight, isLow && styles.stockLabelLow]}>{cur} {p.unit ?? 'adet'}</Text>
                      {isLow && <Text style={styles.kritikBadge}> · Kritik</Text>}
                    </Text>
                    <Text style={styles.cardLastEntry} numberOfLines={1}>{lastLine}</Text>
                    <View style={styles.barBg}>
                      <View
                        style={[
                          styles.barFill,
                          isLow ? styles.barLow : styles.barOk,
                          { width: `${Math.max(pct, 2)}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.cardAction}>
                    <Text style={styles.cardActionText}>Detay</Text>
                    <Ionicons name="chevron-forward" size={18} color={adminTheme.colors.accent} />
                  </View>
                </TouchableOpacity>
              );
            })
            )}
          </ScrollView>
          )}
        </View>

      {/* Alt aksiyon çubuğu */}
      <View
        style={[styles.footer, { paddingBottom: footerPaddingBottom }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.footerBtn}
          onPress={() => router.push('/admin/stock/scan')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={20} color={adminTheme.colors.primary} />
          <Text style={styles.footerBtnText}>Yeni Ürün</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerBtn, styles.footerBtnPrimary]}
          onPress={() => router.push({ pathname: '/admin/stock/movement', params: { type: 'in' } })}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-down-circle-outline" size={20} color="#fff" />
          <Text style={[styles.footerBtnText, styles.footerBtnTextWhite]}>Stok Girişi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerBtn, styles.footerBtnOut]}
          onPress={() => router.push({ pathname: '/admin/stock/movement', params: { type: 'out' } })}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up-circle-outline" size={20} color="#fff" />
          <Text style={[styles.footerBtnText, styles.footerBtnTextWhite]}>Stok Çıkışı</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerBtn}
          onPress={() => router.push('/admin/stock/approvals')}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-done-outline" size={20} color={adminTheme.colors.primary} />
          <Text style={styles.footerBtnText}>Onaylar</Text>
        </TouchableOpacity>
      </View>
      <ImagePreviewModal visible={!!previewUri} uri={previewUri} onClose={() => setPreviewUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: adminTheme.colors.surfaceSecondary,
  },
  header: {
    backgroundColor: adminTheme.colors.primary,
    paddingHorizontal: adminTheme.spacing.lg,
    paddingBottom: adminTheme.spacing.lg,
    borderBottomLeftRadius: adminTheme.radius.lg,
    borderBottomRightRadius: adminTheme.radius.lg,
    ...adminTheme.shadow.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: adminTheme.spacing.md,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: adminTheme.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: adminTheme.colors.surface,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: adminTheme.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: adminTheme.radius.md,
    paddingHorizontal: adminTheme.spacing.md,
  },
  searchIcon: {
    marginRight: 8,
  },
  search: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: adminTheme.colors.surface,
  },
  searchClear: {
    padding: 4,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: adminTheme.colors.error,
    paddingVertical: 10,
    paddingHorizontal: adminTheme.spacing.lg,
    marginHorizontal: adminTheme.spacing.lg,
    marginTop: adminTheme.spacing.lg,
    borderRadius: adminTheme.radius.md,
    ...adminTheme.shadow.sm,
  },
  alertBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  alertBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 6,
  },
  alertScroll: {
    flex: 1,
    maxHeight: 36,
  },
  alertChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: adminTheme.radius.full,
    marginRight: 8,
    justifyContent: 'center',
  },
  alertChipText: {
    fontSize: 12,
    color: '#fff',
    maxWidth: 120,
  },
  categoriesWrap: {
    maxHeight: 52,
    marginTop: adminTheme.spacing.lg,
  },
  categoriesContent: {
    paddingHorizontal: adminTheme.spacing.lg,
    paddingVertical: 4,
    gap: 8,
  },
  listWrapper: {
    flex: 1,
    minHeight: 240,
  },
  sectionHint: {
    fontSize: 11,
    color: adminTheme.colors.textMuted,
    paddingHorizontal: adminTheme.spacing.lg,
    marginBottom: 4,
  },
  sectionHeader: {
    paddingHorizontal: adminTheme.spacing.lg,
    paddingTop: adminTheme.spacing.md,
    paddingBottom: adminTheme.spacing.sm,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: adminTheme.colors.textSecondary,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.md,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: adminTheme.colors.surface,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: adminTheme.colors.textSecondary,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: adminTheme.radius.full,
    marginRight: 8,
    backgroundColor: adminTheme.colors.surface,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
  },
  chipActive: {
    backgroundColor: adminTheme.colors.primary,
    borderColor: adminTheme.colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: adminTheme.colors.textSecondary,
  },
  chipTextActive: {
    color: adminTheme.colors.surface,
  },
  list: {
    flex: 1,
    minHeight: 180,
  },
  listContent: {
    padding: adminTheme.spacing.lg,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: adminTheme.colors.textSecondary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 14,
    color: adminTheme.colors.textMuted,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: adminTheme.colors.surface,
    padding: adminTheme.spacing.md,
    borderRadius: adminTheme.radius.md,
    marginBottom: adminTheme.spacing.sm,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    ...adminTheme.shadow.sm,
  },
  cardLow: {
    borderLeftWidth: 4,
    borderLeftColor: adminTheme.colors.error,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: adminTheme.radius.sm,
    backgroundColor: adminTheme.colors.surfaceTertiary,
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: adminTheme.colors.text,
  },
  cardBarcode: {
    fontSize: 12,
    color: adminTheme.colors.textMuted,
    marginTop: 2,
  },
  cardMetaLine: {
    fontSize: 13,
    color: adminTheme.colors.textSecondary,
    marginTop: 4,
  },
  stockHighlight: {
    fontWeight: '600',
    color: adminTheme.colors.text,
  },
  stockLabelLow: {
    color: adminTheme.colors.error,
    fontWeight: '600',
  },
  kritikBadge: {
    color: adminTheme.colors.error,
    fontWeight: '600',
  },
  cardLastEntry: {
    fontSize: 12,
    color: adminTheme.colors.textMuted,
    marginTop: 2,
  },
  barBg: {
    height: 5,
    backgroundColor: adminTheme.colors.surfaceTertiary,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barOk: {
    backgroundColor: adminTheme.colors.success,
  },
  barLow: {
    backgroundColor: adminTheme.colors.error,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 2,
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: adminTheme.colors.accent,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    flexDirection: 'row',
    paddingHorizontal: adminTheme.spacing.lg,
    paddingTop: 12,
    backgroundColor: adminTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: adminTheme.colors.border,
    gap: 10,
    ...adminTheme.shadow.lg,
    ...(Platform.OS === 'android' && { elevation: 8 }),
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: adminTheme.radius.md,
    backgroundColor: adminTheme.colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
  },
  footerBtnPrimary: {
    backgroundColor: adminTheme.colors.primary,
    borderColor: adminTheme.colors.primary,
  },
  footerBtnOut: {
    backgroundColor: adminTheme.colors.error,
    borderColor: adminTheme.colors.error,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: adminTheme.colors.text,
  },
  footerBtnTextWhite: {
    color: '#fff',
  },
});
