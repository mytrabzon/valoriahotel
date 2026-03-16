import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  category_id: string | null;
  unit: string | null;
  current_stock: number | null;
  min_stock: number | null;
  max_stock: number | null;
  image_url: string | null;
  category: Category | null;
};
type Alert = { id: string; message: string | null; product_id: string; product?: { name: string } };

export default function StockManagement() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: productsData } = await supabase
      .from('stock_products')
      .select('id, name, unit, current_stock, min_stock, max_stock, image_url, category_id, category:stock_categories(id, name)')
      .order('name');
    setProducts(productsData ?? []);

    const { data: categoriesData } = await supabase.from('stock_categories').select('id, name').order('name');
    setCategories(categoriesData ?? []);

    const { data: alertsData } = await supabase
      .from('stock_alerts')
      .select('id, message, product_id, product:stock_products(name)')
      .eq('is_resolved', false);
    setAlerts(alertsData ?? []);
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stok Yönetimi</Text>
        <TextInput
          style={styles.search}
          placeholder="Ürün ara..."
          placeholderTextColor="rgba(255,255,255,0.7)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {alerts.length > 0 && (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>Kritik Stok Uyarıları</Text>
          {alerts.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.alertItem}
              onPress={() => router.push({ pathname: '/admin/stock/movement', params: { productId: a.product_id } })}
            >
              <Text style={styles.alertText}>{(a.product as { name?: string })?.name ?? a.product_id} – {a.message ?? 'Düşük stok'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView horizontal style={styles.categories} showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.chip, selectedCategory === 'all' && styles.chipActive]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text style={[styles.chipText, selectedCategory === 'all' && styles.chipTextActive]}>Tümü</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, selectedCategory === c.id && styles.chipActive]}
            onPress={() => setSelectedCategory(c.id)}
          >
            <Text style={[styles.chipText, selectedCategory === c.id && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filtered.map((p) => {
          const cur = p.current_stock ?? 0;
          const min = p.min_stock ?? 0;
          const max = p.max_stock ?? 1;
          const pct = max > 0 ? Math.min((cur / max) * 100, 100) : 0;
          const isLow = min > 0 && cur <= min;
          return (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/admin/stock/movement', params: { productId: p.id } })}
            >
              <Image source={{ uri: p.image_url || 'https://via.placeholder.com/60' }} style={styles.cardImage} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{p.name}</Text>
                <Text style={styles.cardCat}>{p.category?.name ?? '—'}</Text>
                <View style={styles.stockRow}>
                  <View style={[styles.dot, isLow ? styles.dotRed : styles.dotGreen]} />
                  <Text style={styles.stockText}>Stok: {cur} {p.unit ?? 'adet'}{isLow ? ' (Kritik)' : ''}</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, isLow ? styles.barRed : styles.barGreen, { width: `${pct}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={() => router.push('/admin/stock/scan')}>
          <Text style={styles.footerBtnText}>📷 Barkod Okut</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtn} onPress={() => router.push({ pathname: '/admin/stock/movement', params: { type: 'in' } })}>
          <Text style={styles.footerBtnText}>Stok Giriş</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.footerBtn, styles.footerBtnSec]} onPress={() => router.push('/admin/stock/approvals')}>
          <Text style={styles.footerBtnText}>Onay Bekleyenler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#b8860b', padding: 20 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  search: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14 },
  alertBox: { backgroundColor: '#dc2626', margin: 16, padding: 16, borderRadius: 12 },
  alertTitle: { color: '#fff', fontWeight: '700', marginBottom: 8 },
  alertItem: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 8, marginTop: 6 },
  alertText: { color: '#fff' },
  categories: { paddingHorizontal: 16, paddingVertical: 12, maxHeight: 48 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#b8860b' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextActive: { color: '#fff' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  cardImage: { width: 60, height: 60, borderRadius: 8 },
  cardBody: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardCat: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  stockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  dotRed: { backgroundColor: '#dc2626' },
  dotGreen: { backgroundColor: '#22c55e' },
  stockText: { fontSize: 13 },
  barBg: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barRed: { backgroundColor: '#dc2626' },
  barGreen: { backgroundColor: '#22c55e' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 12 },
  footerBtn: { minWidth: '30%', flex: 1, backgroundColor: '#b8860b', padding: 14, borderRadius: 10 },
  footerBtnSec: { backgroundColor: '#3b82f6' },
  footerBtnText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
