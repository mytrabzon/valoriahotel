import { useRouter } from 'expo-router';
import { View, StyleSheet, Alert } from 'react-native';
import { BarcodeScannerView } from '@/components/BarcodeScannerView';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function StaffStockScanScreen() {
  const router = useRouter();
  const { staff } = useAuthStore();

  const handleScan = async ({ type, data }: { type: string; data: string }) => {
    const barcode = String(data).trim();
    if (!barcode) return;

    const { data: product, error } = await supabase
      .from('stock_products')
      .select('id, name, unit, current_stock, barcode')
      .eq('barcode', barcode)
      .maybeSingle();

    try {
      await supabase.from('barcode_scan_history').insert({
        barcode,
        barcode_type: type,
        product_id: product?.id ?? null,
        scanned_by: staff?.id ?? null,
        scan_result: product ? 'found' : 'not_found',
      });
    } catch (_) {}

    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    if (product) {
      router.replace({ pathname: '/staff/stock/entry', params: { productId: product.id } });
    } else {
      Alert.alert(
        'Ürün bulunamadı',
        'Bu barkoda kayıtlı ürün yok. Lütfen admin ile iletişime geçin veya ürün adı ile arayın.',
        [{ text: 'Tamam' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <BarcodeScannerView
        title="Stok Girişi – Barkod Okut"
        hint="Barkodu çerçeve içine getirin"
        onScan={handleScan}
        onClose={() => router.back()}
        showCloseButton
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
