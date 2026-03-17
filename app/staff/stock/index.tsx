import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';

type Product = {
  id: string;
  name: string;
  unit: string | null;
  current_stock: number | null;
  min_stock: number | null;
  category: { name: string } | null;
};

type MovementRow = {
  id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  product: { name: string } | null;
};

export default function StaffStockListScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [recent, setRecent] = useState<MovementRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('stock_products')
      .select('id, name, unit, current_stock, min_stock, category:stock_categories(name)')
      .order('name');
    setProducts(data ?? []);
  };

  const loadRecent = async () => {
    setLoadingRecent(true);
    const { data } = await supabase
      .from('stock_movements')
      .select('id, movement_type, quantity, created_at, status, product:stock_products(name)')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecent((data ?? []) as MovementRow[]);
    setLoadingRecent(false);
  };

  useEffect(() => {
    load();
    loadRecent();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadRecent()]);
    setRefreshing(false);
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const inStock = filtered.filter((p) => (p.current_stock ?? 0) > 0);
  const outOfStock = filtered.filter((p) => (p.current_stock ?? 0) <= 0);
  const lowStock = filtered.filter((p) => {
    const min = p.min_stock ?? 0;
    const cur = p.current_stock ?? 0;
    return min > 0 && cur <= min && cur > 0;
  });
  const inStockNotLow = inStock.filter((p) => !lowStock.some((l) => l.id === p.id));

  const critical = lowStock.slice(0, 5);

  return (
    <View style={styles.container}>
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/staff/stock/scan')} activeOpacity={0.8}>
          <Ionicons name="barcode-outline" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>Barkod Okut</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnOutline} onPress={() => router.push('/staff/stock/entry')} activeOpacity={0.8}>
          <Ionicons name="download-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.actionBtnOutlineText}>Stok Girişi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnOutline} onPress={() => router.push('/staff/stock/exit')} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.actionBtnOutlineText}>Stok Çıkışı</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.search}
          placeholder="Ürün ara..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={12}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Son işlemler</Text>
          {loadingRecent ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : recent.length === 0 ? (
            <Text style={styles.emptyText}>Henüz işlem yok.</Text>
          ) : (
            <View style={styles.recentCard}>
              {recent.map((m) => {
                const name = (m.product as { name?: string } | null)?.name ?? '—';
                const typeLabel = m.movement_type === 'in' ? 'Giriş' : 'Çıkış';
                const time = new Date(m.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                const statusLabel = m.status === 'pending' ? 'Onay bekliyor' : (m.status === 'approved' ? 'Onaylandı' : 'Reddedildi');
                return (
                  <View key={m.id} style={styles.recentRow}>
                    <Text style={styles.recentText}>{typeLabel} · {name} ({m.quantity})</Text>
                    <Text style={styles.recentMeta}>{time} · {statusLabel}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {lowStock.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Kritik stok</Text>
            <View style={styles.criticalCard}>
              {critical.map((p) => (
                <View key={p.id} style={styles.criticalRow}>
                  <Text style={styles.cardName}>{p.name}</Text>
                  <Text style={styles.cardStock}>Stok: {p.current_stock ?? 0} {p.unit ?? 'adet'} (Min: {p.min_stock ?? 0})</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Stokta olanlar ({inStock.length})</Text>
          {inStock.length === 0 && (
            <Text style={styles.emptyText}>Stokta ürün yok veya arama sonucu yok.</Text>
          )}
          {inStockNotLow.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/staff/stock/entry', params: { productId: p.id } })}
            >
              <Text style={styles.cardName}>{p.name}</Text>
              <Text style={styles.cardCat}>{p.category?.name ?? '—'}</Text>
              <Text style={styles.cardStock}>{p.current_stock ?? 0} {p.unit ?? 'adet'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❌ Stokta yok ({outOfStock.length})</Text>
          {outOfStock.slice(0, 30).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.cardOut}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/staff/stock/entry', params: { productId: p.id } })}
            >
              <Text style={styles.cardName}>{p.name}</Text>
              <Text style={styles.cardStock}>0 {p.unit ?? 'adet'}</Text>
            </TouchableOpacity>
          ))}
          {outOfStock.length > 30 && (
            <Text style={styles.moreText}>+{outOfStock.length - 30} ürün daha</Text>
          )}
        </View>
      </ScrollView>

      {/* footer removed: quick actions are on top */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  topActions: { padding: 16, gap: 10, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  actionBtn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  actionBtnOutline: { borderWidth: 2, borderColor: theme.colors.primary, paddingVertical: 12, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.surface },
  actionBtnOutlineText: { color: theme.colors.primary, fontWeight: '800', fontSize: 15 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight, flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: { flex: 1, backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.radius.md, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: theme.colors.text },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 10 },
  recentCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderLight, overflow: 'hidden' },
  recentRow: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderLight },
  recentText: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  recentMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  criticalCard: { backgroundColor: '#fef3c7', borderRadius: theme.radius.lg, padding: 12, borderLeftWidth: 4, borderLeftColor: theme.colors.error },
  criticalRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  card: { backgroundColor: theme.colors.surface, padding: 14, borderRadius: theme.radius.lg, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.borderLight },
  cardOut: { backgroundColor: theme.colors.surface, padding: 14, borderRadius: theme.radius.lg, marginBottom: 8, opacity: 0.8, borderWidth: 1, borderColor: theme.colors.borderLight },
  cardName: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  cardCat: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  cardStock: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic' },
  moreText: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
});
