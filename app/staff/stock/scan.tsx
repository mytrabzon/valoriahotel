import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet, Alert } from 'react-native';
import { BarcodeScannerView } from '@/components/BarcodeScannerView';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from 'react-i18next';

export default function StaffStockScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { staff } = useAuthStore();
  const { t } = useTranslation();

  const handleScan = async ({ type, data }: { type: string; data: string }) => {
    const barcode = String(data).trim();
    if (!barcode) return;

    const { data: product, error } = await supabase
      .from('stock_products')
      .select('id, name, unit, current_stock, barcode')
      .eq('barcode', barcode)
      .maybeSingle();

    if (error) {
      Alert.alert(t('error'), error.message);
      return;
    }

    let productId = product?.id;

    if (!product) {
      // Barkoda kayıtlı ürün yok: stok girişine barkod + ürün adı (Ürün - barkod) ile git, kullanıcı adı düzenleyip kaydetsin
      try {
        await supabase.from('barcode_scan_history').insert({
          barcode,
          barcode_type: type,
          scanned_by: staff?.id ?? null,
          scan_result: 'not_found',
        });
      } catch (_) {}
      if (params.returnTo === 'exit') {
        Alert.alert(t('productNotFoundTitle'), t('productNotFoundStockExitMessage'));
        return;
      }
      router.replace(`/staff/stock/entry?barcode=${encodeURIComponent(barcode)}`);
      return;
    }

    try {
      await supabase.from('barcode_scan_history').insert({
        barcode,
        barcode_type: type,
        product_id: productId ?? undefined,
        scanned_by: staff?.id ?? null,
        scan_result: 'found',
      });
    } catch (_) {}

    if (params.returnTo === 'exit' && productId) {
      router.replace({ pathname: '/staff/stock/exit', params: { productId } });
      return;
    }
    if (productId) {
      router.replace(`/staff/stock/entry?productId=${productId}`);
    } else {
      router.replace(`/staff/stock/entry?barcode=${encodeURIComponent(barcode)}`);
    }
  };

  return (
    <View style={styles.container}>
      <BarcodeScannerView
        title={params.returnTo === 'exit' ? t('stockScanExitTitle') : t('stockScanEntryTitle')}
        hint={t('barcodeAlignHint')}
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
