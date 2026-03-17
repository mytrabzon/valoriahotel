import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { notifyAdmins } from '@/lib/notificationService';

const DEPARTMENTS = [
  { value: 'housekeeping', label: 'Temizlik' },
  { value: 'technical', label: 'Teknik Servis' },
  { value: 'receptionist', label: 'Resepsiyon' },
  { value: 'security', label: 'Güvenlik' },
  { value: 'other', label: 'Diğer' },
];

export default function JoinValoriaScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [full_name, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [applied_department, setAppliedDepartment] = useState('');
  const [experience, setExperience] = useState('');
  const [terms_accepted, setTermsAccepted] = useState(false);

  const submit = async () => {
    if (!full_name.trim()) {
      Alert.alert('Hata', 'Ad Soyad girin.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Hata', 'E-posta girin.');
      return;
    }
    if (!applied_department) {
      Alert.alert('Hata', 'Başvurduğunuz departmanı seçin.');
      return;
    }
    if (!terms_accepted) {
      Alert.alert('Hata', 'Kullanım şartlarını kabul etmelisiniz.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('staff_applications').insert({
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        applied_department: applied_department,
        experience: experience.trim() || null,
        terms_accepted: true,
        status: 'pending',
      });
      if (error) throw error;
      notifyAdmins({
        title: '📋 Yeni personel başvurusu',
        body: `${full_name.trim()} başvurdu. Onay bekleyenler listesini kontrol edin.`,
        data: { url: '/admin/staff/pending' },
      }).catch(() => {});
      Alert.alert(
        'Başvuru alındı',
        'Başvurunuz admin onayından sonra aktive olacaktır. E-posta ile bilgilendirileceksiniz.',
        [{ text: 'Tamam', onPress: () => setTimeout(() => router.replace('/'), 0) }]
      );
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Başvuru gönderilemedi.');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>👤 Valoria'ya katıl</Text>
        <Text style={styles.subtitle}>Personel başvurusu</Text>

        <Text style={styles.label}>Ad Soyad *</Text>
        <TextInput
          style={styles.input}
          value={full_name}
          onChangeText={setFullName}
          placeholder="Ahmet Yılmaz"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.label}>E-posta *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="ahmet@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.label}>Telefon</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+90 555 123 45 67"
          keyboardType="phone-pad"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Başvurduğunuz departman *</Text>
        <View style={styles.chips}>
          {DEPARTMENTS.map((d) => (
            <TouchableOpacity
              key={d.value}
              style={[styles.chip, applied_department === d.value && styles.chipActive]}
              onPress={() => setAppliedDepartment(d.value)}
            >
              <Text
                style={[styles.chipText, applied_department === d.value && styles.chipTextActive]}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Deneyim (isteğe bağlı)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={experience}
          onChangeText={setExperience}
          placeholder="Daha önce otelcilik sektöründe 3 yıl çalıştım..."
          placeholderTextColor="#9ca3af"
          multiline
        />

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setTermsAccepted(!terms_accepted)}
        >
          <Text style={styles.checkbox}>{terms_accepted ? '☑' : '☐'}</Text>
          <Text style={styles.checkLabel}>Kullanım şartlarını kabul ediyorum.</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color="#1a365d" style={{ marginTop: 24 }} />
        ) : (
          <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
            <Text style={styles.buttonText}>📨 Başvuruyu gönder</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Geri</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a202c', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#718096', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#4a5568', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: { minHeight: 80 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1a365d' },
  chipText: { color: '#4a5568', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  checkbox: { fontSize: 18, marginRight: 10 },
  checkLabel: { fontSize: 15, color: '#374151', flex: 1 },
  button: {
    backgroundColor: '#1a365d',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  backLink: { marginTop: 20, alignItems: 'center' },
  backLinkText: { fontSize: 15, color: '#4a5568' },
});
