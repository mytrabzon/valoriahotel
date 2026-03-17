import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logger';

export default function AuthSetPasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      log.info('AuthSetPassword', 'Şifre güncellendi');
      Alert.alert('Şifre güncellendi', 'Yeni şifrenizle giriş yapabilirsiniz.', [
        { text: 'Tamam', onPress: () => router.replace('/auth') },
      ]);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Şifre güncellenemedi.';
      log.error('AuthSetPassword', 'updateUser', err, msg);
      Alert.alert('Hata', msg);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={60}
    >
      <Text style={styles.title}>Yeni şifre belirleyin</Text>
      <Text style={styles.subtitle}>Şifre sıfırlama linkine tıkladınız. Aşağıdan yeni şifrenizi girin.</Text>

      <Text style={styles.label}>Yeni şifre (en az 6 karakter)</Text>
      <TextInput
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor="#9ca3af"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        editable={!loading}
      />

      <Text style={styles.label}>Yeni şifre (tekrar)</Text>
      <TextInput
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor="#9ca3af"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, (!newPassword || newPassword !== confirmPassword) && styles.buttonDisabled]}
        onPress={submit}
        disabled={!newPassword || newPassword !== confirmPassword || loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Güncelleniyor...' : 'Şifreyi kaydet'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/auth')}>
        <Text style={styles.backBtnText}>← Giriş sayfasına dön</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 24,
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1d21', textAlign: 'center', marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#1a1d21', marginBottom: 8 },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    color: '#1a1d21',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  button: {
    backgroundColor: '#b8860b',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  backBtn: { marginTop: 24, alignSelf: 'center' },
  backBtnText: { color: '#6c757d', fontSize: 16 },
});
