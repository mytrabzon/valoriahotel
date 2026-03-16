import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

type Product = { id: string; name: string; unit: string | null; current_stock: number | null; min_stock?: number | null };

export default function StaffStockEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string }>();
  const { staff } = useAuthStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [staffImage, setStaffImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (params.productId) {
      supabase
        .from('stock_products')
        .select('id, name, unit, current_stock, min_stock')
        .eq('id', params.productId)
        .single()
        .then(({ data }) => setProduct(data ?? null));
    } else {
      supabase.from('stock_products').select('id, name, unit, current_stock').order('name').then(({ data }) => setProducts(data ?? []));
    }
  }, [params.productId]);

  const uploadPhoto = async (base64: string): Promise<string> => {
    const arrayBuffer = decode(base64);
    const fileName = `stock/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('stock-proofs').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('stock-proofs').getPublicUrl(fileName);
    return publicUrl;
  };

  const takePhoto = async (kind: 'staff' | 'product') => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0].base64) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(result.assets[0].base64);
      if (kind === 'staff') setStaffImage(url);
      else setPhoto(url);
    } catch {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const saveMovement = async () => {
    if (!product || !quantity || !staff?.id) {
      Alert.alert('Eksik', 'Ürün, miktar gerekli.');
      return;
    }
    const q = parseInt(quantity, 10);
    if (isNaN(q) || q <= 0) {
      Alert.alert('Hata', 'Geçerli miktar girin.');
      return;
    }
    const { error } = await supabase.from('stock_movements').insert({
      product_id: product.id,
      movement_type: 'in',
      quantity: q,
      staff_id: staff.id,
      staff_image: staffImage,
      photo_proof: photo,
      notes: notes || null,
      status: 'pending',
    });

    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    Alert.alert('Kaydedildi', 'Stok girişiniz admin onayından sonra işlenecek.', () => router.replace('/staff/stock/entry'));
  };

  const clearProduct = () => router.replace('/staff/stock/entry');

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  // Ürün seçilmemiş: Barkod Okut + manuel arama
  if (!product) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.barcodeBtn} onPress={() => router.push('/staff/stock/scan')}>
          <Text style={styles.barcodeBtnText}>📷 Barkod Okut</Text>
        </TouchableOpacity>
        <Text style={styles.orLabel}>veya manuel giriş</Text>
        <Text style={styles.label}>Ürün ara</Text>
        <TextInput style={styles.input} placeholder="Ürün adı yazın..." value={search} onChangeText={setSearch} />
        {search.length >= 2 && (
          <View style={styles.searchList}>
            {filteredProducts.slice(0, 12).map((p) => (
              <TouchableOpacity key={p.id} style={styles.searchItem} onPress={() => { setProduct(p); setSearch(''); }}>
                <Text style={styles.searchItemName}>{p.name}</Text>
                <Text style={styles.searchItemStock}>{p.current_stock ?? 0} {p.unit ?? 'adet'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  // Ürün seçilmiş: miktar, fotoğraf, not, gönder
  const cur = product.current_stock ?? 0;
  const min = product.min_stock ?? 0;
  const isLow = min > 0 && cur <= min;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.productCard}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productStock}>Mevcut stok: {cur} {product.unit ?? 'adet'}{isLow ? ' (Kritik)' : ''}</Text>
        <TouchableOpacity style={styles.changeProductBtn} onPress={clearProduct}>
          <Text style={styles.changeProductBtnText}>Başka ürün seç</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Eklenecek miktar ({product.unit ?? 'adet'})</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={quantity}
        onChangeText={setQuantity}
      />

      <Text style={styles.label}>Teslim alan çalışan fotoğrafı (isteğe bağlı)</Text>
      {staffImage ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: staffImage }} style={styles.photo} />
          <TouchableOpacity style={styles.removePhoto} onPress={() => setStaffImage(null)}><Text style={styles.removePhotoText}>✕</Text></TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.photoPlaceholder} onPress={() => takePhoto('staff')} disabled={uploading}>
          <Text style={styles.photoPlaceholderText}>📷 Çalışan fotoğrafı çek</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.label}>Ürün fotoğrafı (isteğe bağlı)</Text>
      {photo ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: photo }} style={[styles.photo, styles.photoLarge]} />
          <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}><Text style={styles.removePhotoText}>✕</Text></TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.photoPlaceholder} onPress={() => takePhoto('product')} disabled={uploading}>
          <Text style={styles.photoPlaceholderText}>📷 Ürün fotoğrafı çek</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.label}>Not</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="Açıklama..." multiline numberOfLines={2} value={notes} onChangeText={setNotes} />

      <Text style={styles.warning}>Stok girişiniz admin onayından sonra işlenecektir.</Text>

      <TouchableOpacity
        style={[styles.submit, (!quantity || parseInt(quantity, 10) <= 0) && styles.submitDisabled]}
        onPress={saveMovement}
        disabled={!quantity || parseInt(quantity, 10) <= 0}
      >
        <Text style={styles.submitText}>Stok girişi yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingBottom: 40 },
  barcodeBtn: { backgroundColor: '#b8860b', padding: 18, borderRadius: 12, marginBottom: 12 },
  barcodeBtnText: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 17 },
  orLabel: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#fff' },
  textArea: { minHeight: 72 },
  searchList: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, marginTop: 8, backgroundColor: '#fff', maxHeight: 280 },
  searchItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  searchItemName: { fontSize: 15, fontWeight: '500' },
  searchItemStock: { fontSize: 13, color: '#6b7280' },
  productCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#b8860b' },
  productName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  productStock: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  changeProductBtn: { marginTop: 12 },
  changeProductBtnText: { fontSize: 14, color: '#b8860b', fontWeight: '600' },
  photoWrap: { position: 'relative', marginBottom: 16 },
  photo: { width: 120, height: 120, borderRadius: 10 },
  photoLarge: { width: '100%', height: 180 },
  removePhoto: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center' },
  removePhotoText: { color: '#fff', fontWeight: '700' },
  photoPlaceholder: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 10, padding: 24, alignItems: 'center', backgroundColor: '#fff', marginBottom: 16 },
  photoPlaceholderText: { color: '#6b7280' },
  warning: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  submit: { backgroundColor: '#b8860b', padding: 16, borderRadius: 10 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 16 },
});
