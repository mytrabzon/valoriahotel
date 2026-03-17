import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { adminTheme } from '@/constants/adminTheme';

const PAYMENT_TYPES = [
  { value: 'transfer', label: 'Havale / EFT' },
  { value: 'cash', label: 'Nakit' },
  { value: 'credit_card', label: 'Kredi Kartı' },
] as const;

export default function AdminSalaryEditScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentTime, setPaymentTime] = useState('');
  const [paymentType, setPaymentType] = useState<'transfer' | 'cash' | 'credit_card'>('transfer');
  const [bankOrReference, setBankOrReference] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!paymentId) return;
    const { data, error } = await supabase
      .from('salary_payments')
      .select('amount, payment_date, payment_time, payment_type, bank_or_reference, description')
      .eq('id', paymentId)
      .single();
    if (error || !data) {
      Alert.alert('Hata', 'Kayıt bulunamadı.');
      router.back();
      return;
    }
    setAmount(String((data as any).amount ?? ''));
    setPaymentDate((data as any).payment_date ?? '');
    setPaymentTime((data as any).payment_time ? String((data as any).payment_time).slice(0, 5) : '');
    setPaymentType(((data as any).payment_type as any) ?? 'transfer');
    setBankOrReference((data as any).bank_or_reference ?? '');
    setDescription((data as any).description ?? '');
    setLoading(false);
  }, [paymentId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const num = parseFloat(amount.replace(/,/g, '.'));
    if (!num || num <= 0) {
      Alert.alert('Eksik bilgi', 'Geçerli maaş tutarı girin.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('salary_payments')
      .update({
        amount: num,
        payment_date: paymentDate || null,
        payment_time: paymentTime || null,
        payment_type: paymentType,
        bank_or_reference: bankOrReference.trim() || null,
        description: description.trim() || null,
      })
      .eq('id', paymentId);

    setSaving(false);
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    Alert.alert('Kaydedildi', 'Maaş kaydı güncellendi.', [{ text: 'Tamam', onPress: () => router.back() }]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={adminTheme.colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Maaş tutarı (₺)</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Text style={styles.label}>Ödeme tarihi</Text>
        <TextInput style={styles.input} value={paymentDate} onChangeText={setPaymentDate} placeholder="YYYY-MM-DD" />
        <Text style={styles.label}>Ödeme saati</Text>
        <TextInput style={styles.input} value={paymentTime} onChangeText={setPaymentTime} placeholder="14:30" />
        <Text style={styles.label}>Ödeme türü</Text>
        <View style={styles.radioGroup}>
          {PAYMENT_TYPES.map((opt) => (
            <TouchableOpacity key={opt.value} style={styles.radioRow} onPress={() => setPaymentType(opt.value)}>
              <Ionicons name={paymentType === opt.value ? 'radio-button-on' : 'radio-button-off'} size={22} color={adminTheme.colors.accent} />
              <Text style={styles.radioLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Banka / İşlem no</Text>
        <TextInput style={[styles.input, styles.textArea]} value={bankOrReference} onChangeText={setBankOrReference} multiline />
        <Text style={styles.label}>Açıklama</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline />
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={saving}>
            <Text style={styles.cancelBtnText}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: adminTheme.colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    borderRadius: adminTheme.radius.sm,
    padding: 12,
    fontSize: 15,
    backgroundColor: adminTheme.colors.surface,
    color: adminTheme.colors.text,
    marginBottom: 16,
  },
  textArea: { minHeight: 60 },
  radioGroup: { marginBottom: 16 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  radioLabel: { fontSize: 14, color: adminTheme.colors.text },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: adminTheme.radius.md, borderWidth: 1, borderColor: adminTheme.colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: adminTheme.colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: adminTheme.radius.md, backgroundColor: adminTheme.colors.accent, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
