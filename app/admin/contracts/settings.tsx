import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, supabaseUrl } from '@/lib/supabase';

const KEYS = {
  google_play_url: 'Google Play (Android) uygulama URL',
  app_store_url: 'App Store (iOS) uygulama URL',
  contract_qr_base_url: 'Sözleşme onay sayfası base URL (QR\'da kullanılacak; boş = Supabase)',
  checkin_qr_base_url: 'Check-in QR base URL (boş = varsayılan)',
} as const;

const SUPABASE_CONTRACT_PATH = '/functions/v1/public-contract';
const defaultContractBase = supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}${SUPABASE_CONTRACT_PATH}` : '';

export default function ContractAppSettings() {
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>({
    google_play_url: '',
    app_store_url: '',
    contract_qr_base_url: '',
    checkin_qr_base_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [singleQrUrl, setSingleQrUrl] = useState<string>('');
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', Object.keys(KEYS));
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: { key: string; value: unknown }) => {
        const v = r.value;
        map[r.key] = v != null && v !== '' ? String(v) : '';
      });
      setValues((prev) => ({ ...prev, ...map }));

      const { data: lobbyRow } = await supabase
        .from('contract_lobby_tokens')
        .select('token')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const base = (map.contract_qr_base_url || defaultContractBase).replace(/\/$/, '');
      if (lobbyRow?.token && base) {
        setSingleQrUrl(`${base}?t=${encodeURIComponent(lobbyRow.token)}&l=tr`);
      }
      setLoading(false);
    })();
  }, []);

  const setOne = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const contractBase = (values.contract_qr_base_url || defaultContractBase).replace(/\/$/, '');

  const generateLobbyToken = async () => {
    setGeneratingToken(true);
    try {
      const { data: token, error } = await supabase.rpc('generate_contract_lobby_token');
      if (error) throw error;
      if (token && contractBase) {
        const url = `${contractBase}?t=${encodeURIComponent(token)}&l=tr`;
        setSingleQrUrl(url);
        try {
          await Share.share({ message: url, title: 'Sözleşme onay sayfası (tek QR)' });
        } catch {
          // paylaşım iptal veya destek yok
        }
        Alert.alert('Token oluşturuldu', 'Tek QR URL kopyalandı / paylaşıldı. Bu linki QR koduna basabilirsiniz.');
      }
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Token oluşturulamadı');
    }
    setGeneratingToken(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const key of Object.keys(KEYS)) {
        const val = (values[key] ?? '').trim() || null;
        await supabase.from('app_settings').upsert({ key, value: val as string | null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
      Alert.alert('Kaydedildi', 'Ayarlar güncellendi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kaydedilemedi');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a365d" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 56}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Supabase sözleşme sayfası URL'si</Text>
        <View style={styles.readOnlyBox}>
          <Text style={styles.readOnlyLabel}>Varsayılan (Supabase Edge Function):</Text>
          <Text style={styles.readOnlyValue} selectable>{defaultContractBase || '— EXPO_PUBLIC_SUPABASE_URL gerekli'}</Text>
        </View>
        <Text style={styles.hint}>Bu adres tek QR veya oda bazlı QR base adresi olarak kullanılır. Özel domain kullanmak için aşağıdaki base URL alanını doldurun.</Text>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Mağaza linkleri (sözleşme onayı sonrası yönlendirme)</Text>
        {(Object.keys(KEYS) as (keyof typeof KEYS)[]).map((key) => (
          <View key={key} style={styles.field}>
            <Text style={styles.label}>{KEYS[key]}</Text>
            <TextInput
              style={styles.input}
              value={values[key] ?? ''}
              onChangeText={(t) => setOne(key, t)}
              placeholder={key.includes('url') ? 'https://...' : ''}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ))}
        <Text style={styles.hint}>
          Google Play ve App Store URL'lerini girin. Sözleşme onayı tamamlandığında müşteri cihazına göre ilgili mağazaya yönlendirilir. Base URL'ler boş bırakılırsa uygulama varsayılanını kullanır.
        </Text>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Tek QR kodu – sözleşme onay sayfası</Text>
        <Text style={styles.hint}>
          Tek bir QR ile misafir doğrudan sözleşme onay sayfasına gider. Oda seçimi yok; onay sonrası admin çalışan atar, çalışan oda ataması yapar.
        </Text>
        <TouchableOpacity style={styles.tokenBtn} onPress={generateLobbyToken} disabled={generatingToken || !contractBase}>
          {generatingToken ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.tokenBtnText}>Yeni token oluştur (tek QR URL)</Text>}
        </TouchableOpacity>
        {singleQrUrl ? (
          <View style={styles.field}>
            <Text style={styles.label}>Tek QR tam URL (kopyalayıp QR yapın)</Text>
            <TextInput style={[styles.input, styles.readOnlyInput]} value={singleQrUrl} editable={false} />
          </View>
        ) : null}

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#64748b' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 20, lineHeight: 18 },
  readOnlyBox: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, marginBottom: 8 },
  readOnlyLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  readOnlyValue: { fontSize: 13, color: '#1e293b', fontFamily: 'monospace' },
  tokenBtn: { backgroundColor: '#0369a1', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  tokenBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  readOnlyInput: { backgroundColor: '#f8fafc' },
  saveBtn: { backgroundColor: '#1a365d', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
