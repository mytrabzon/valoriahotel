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

const MAGIC_LINK_REDIRECT = 'valoria-hotel://auth/callback';

export default function AuthEmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sendCode = async () => {
    const e = email.trim().toLowerCase();
    if (!e) {
      Alert.alert('Hata', 'E-posta adresinizi girin.');
      return;
    }
    setLoading(true);
    setSent(false);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: MAGIC_LINK_REDIRECT,
        },
      });
      if (error) throw error;
      setSent(true);
      log.info('AuthEmail', 'OTP/Magic link gönderildi', { email: e.slice(0, 5) + '...' });
      router.push({ pathname: '/auth/code', params: { email: e } });
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Kod gönderilemedi.';
      log.error('AuthEmail', 'signInWithOtp', err, msg);
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
      <Text style={styles.title}>E-posta ile Giriş / Kayıt</Text>
      <Text style={styles.subtitle}>
        E-posta adresinize 6 haneli kod veya giriş linki göndereceğiz.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="E-posta"
        placeholderTextColor="rgba(255,255,255,0.5)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <TouchableOpacity style={styles.button} onPress={sendCode} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Gönderiliyor...' : 'Kod / Magic link gönder'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        E-postayı kontrol edin. 6 haneli kodu aşağıdaki ekrana girebilir veya e-postadaki linke tıklayarak uygulamada giriş yapabilirsiniz.
      </Text>

      <View style={styles.links}>
        <TouchableOpacity onPress={() => router.push('/auth/password')}>
          <Text style={styles.linkText}>Şifre ile giriş</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({ pathname: '/auth/password', params: { signUp: '1' } })}>
          <Text style={styles.linkText}>Kayıt ol</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/auth/reset')}>
          <Text style={styles.linkText}>Şifremi unuttum</Text>
        </TouchableOpacity>
      </View>

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
  hint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16 },
  linkText: { color: '#90cdf4', fontSize: 14 },
  backBtn: { marginTop: 24, alignSelf: 'center' },
  backBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
});
