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

export default function AuthResetScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sendReset = async () => {
    const e = email.trim().toLowerCase();
    if (!e) {
      Alert.alert('Hata', 'E-posta adresinizi girin.');
      return;
    }
    setLoading(true);
    setSent(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: 'valoria-hotel://auth/callback',
      });
      if (error) throw error;
      setSent(true);
      log.info('AuthReset', 'Şifre sıfırlama e-postası gönderildi', { email: e.slice(0, 5) + '...' });
      Alert.alert(
        'E-posta gönderildi',
        'Şifre sıfırlama linki e-posta adresinize gönderildi. E-postayı kontrol edin.',
        [{ text: 'Tamam', onPress: () => router.replace('/auth') }]
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Şifre sıfırlama e-postası gönderilemedi.';
      log.error('AuthReset', 'resetPasswordForEmail', err, msg);
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
      <Text style={styles.title}>Şifremi unuttum</Text>
      <Text style={styles.subtitle}>
        E-posta adresinize şifre sıfırlama linki göndereceğiz.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="E-posta"
        placeholderTextColor="rgba(255,255,255,0.5)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
      />

      <TouchableOpacity style={styles.button} onPress={sendReset} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Gönderiliyor...' : 'Sıfırlama linki gönder'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Geri</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a365d',
    padding: 24,
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#ed8936',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  backBtn: { marginTop: 24, alignSelf: 'center' },
  backBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
});
