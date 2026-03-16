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

type Product = { id: string; name: string; unit: string | null; current_stock: number | null };

export default function StockMovementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; productId?: string }>();
  const type = (params.type as 'in' | 'out') || 'in';
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
      supabase.from('stock_products').select('id, name, unit, current_stock').eq('id', params.productId).single().then(({ data }) => setProduct(data ?? null));
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
      Alert.alert('Eksik', 'Ürün, miktar ve giriş yapmış personel gerekli.');
      return;
    }
    const q = parseInt(quantity, 10);
    if (isNaN(q) || q <= 0) {
      Alert.alert('Hata', 'Geçerli miktar girin.');
      return;
    }
    const { data: movement, error } = await supabase
      .from('stock_movements')
      .insert({
        product_id: product.id,
        movement_type: type,
        quantity: q,
        staff_id: staff.id,
        staff_image: staffImage,
        photo_proof: photo,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    Alert.alert('Kaydedildi', 'Admin onayından sonra stok güncellenecek.', () => router.back());
  };

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{type === 'in' ? 'Stok Girişi' : 'Stok Çıkışı'}</Text>

      {!params.productId ? (
        <View style={styles.section}>
          <TouchableOpacity style={styles.barcodeBtn} onPress={() => router.push('/admin/stock/scan')}>
            <Text style={styles.barcodeBtnText}>📷 Barkod Okut</Text>
          </TouchableOpacity>
          <Text style={styles.label}>veya ürün ara</Text>
          <TextInput style={styles.input} placeholder="Ürün adı..." value={search} onChangeText={setSearch} />
          {search.length >= 2 && (
            <View style={styles.searchList}>
              {filteredProducts.slice(0, 10).map((p) => (
                <TouchableOpacity key={p.id} style={styles.searchItem} onPress={() => { setProduct(p); setSearch(''); }}>
                  <Text>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {product && (
        <View style={styles.section}>
          <Text style={styles.label}>Seçilen ürün</Text>
          <View style={styles.productBox}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productStock}>Mevcut: {product.current_stock ?? 0} {product.unit ?? 'adet'}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Miktar ({product?.unit ?? 'adet'})</Text>
        <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={quantity} onChangeText={setQuantity} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Teslim alan çalışan fotoğrafı</Text>
        {staffImage ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: staffImage }} style={styles.photo} />
            <TouchableOpacity style={styles.removePhoto} onPress={() => setStaffImage(null)}><Text style={styles.removePhotoText}>✕</Text></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoPlaceholder} onPress={() => takePhoto('staff')} disabled={uploading}>
            <Text style={styles.photoPlaceholderText}>Çalışan fotoğrafı çek</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Ürün fotoğrafı (kanıt)</Text>
        {photo ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photo }} style={[styles.photo, styles.photoLarge]} />
            <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}><Text style={styles.removePhotoText}>✕</Text></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoPlaceholder} onPress={() => takePhoto('product')} disabled={uploading}>
            <Text style={styles.photoPlaceholderText}>Ürün fotoğrafı çek</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notlar</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Açıklama..." multiline numberOfLines={3} value={notes} onChangeText={setNotes} />
      </View>

      <TouchableOpacity
        style={[styles.submit, (!product || !quantity) && styles.submitDisabled]}
        onPress={saveMovement}
        disabled={!product || !quantity}
      >
        <Text style={styles.submitText}>{type === 'in' ? 'STOK GİRİŞİ YAP' : 'STOK ÇIKIŞI YAP'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  section: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14 },
  textArea: { minHeight: 80 },
  searchList: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, marginTop: 8, maxHeight: 200 },
  searchItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  productBox: { backgroundColor: '#f9fafb', padding: 16, borderRadius: 10 },
  productName: { fontSize: 16, fontWeight: '700' },
  productStock: { fontSize: 14, color: '#666', marginTop: 4 },
  photoWrap: { position: 'relative' },
  photo: { width: 120, height: 120, borderRadius: 10 },
  photoLarge: { width: '100%', height: 180 },
  removePhoto: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center' },
  removePhotoText: { color: '#fff', fontWeight: '700' },
  photoPlaceholder: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 10, padding: 32, alignItems: 'center' },
  photoPlaceholderText: { color: '#6b7280' },
  submit: { backgroundColor: '#b8860b', padding: 16, borderRadius: 10 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 16 },
  barcodeBtn: { backgroundColor: '#1a365d', padding: 16, borderRadius: 10, marginBottom: 16 },
  barcodeBtnText: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 16 },
});
