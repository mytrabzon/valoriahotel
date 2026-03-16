import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logger';

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const signIn = async () => {
    if (!email.trim() || !password) {
      log.warn('AdminLogin', 'Eksik email/şifre');
      Alert.alert('Hata', 'E-posta ve şifre girin.');
      return;
    }
    setLoading(true);
    log.info('AdminLogin', 'signIn başladı', { email: email.trim().slice(0, 5) + '...' });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        log.error('AdminLogin', 'signInWithPassword', error.message, error.status);
        throw error;
      }
      log.info('AdminLogin', 'auth OK', { userId: data.user?.id?.slice(0, 8) });
      if (data.user) {
        const { data: staff, error: staffErr } = await supabase.from('staff').select('id').eq('auth_id', data.user.id).single();
        if (staffErr) {
          log.error('AdminLogin', 'staff fetch', staffErr.message, staffErr.code);
        }
        if (!staff) {
          await supabase.auth.signOut();
          log.warn('AdminLogin', 'Personel değil, signOut');
          Alert.alert('Yetkisiz', 'Bu hesap personel olarak tanımlı değil.');
          setLoading(false);
          return;
        }
        log.info('AdminLogin', 'Yönlendirme /admin');
        router.replace('/admin');
      }
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? 'Giriş yapılamadı.';
      log.error('AdminLogin', 'signIn catch', e, msg);
      Alert.alert('Giriş hatası', msg);
    }
    setLoading(false);
  };

  const signInWithApple = async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { identityToken } = credential;
      if (!identityToken) {
        Alert.alert('Hata', 'Apple girişi token alınamadı.');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });
      if (error) {
        log.error('AdminLogin', 'signInWithIdToken', error.message);
        throw error;
      }
      if (data.user) {
        const { data: staff, error: staffErr } = await supabase.from('staff').select('id').eq('auth_id', data.user.id).single();
        if (staffErr) log.error('AdminLogin', 'staff fetch', staffErr.message);
        if (!staff) {
          await supabase.auth.signOut();
          Alert.alert('Yetkisiz', 'Bu hesap personel olarak tanımlı değil.');
          setLoading(false);
          return;
        }
        router.replace('/admin');
      }
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        log.info('AdminLogin', 'Apple giriş iptal');
        setLoading(false);
        return;
      }
      const msg = (e as Error)?.message ?? 'Apple ile giriş yapılamadı.';
      log.error('AdminLogin', 'Apple signIn', e, msg);
      Alert.alert('Apple Giriş Hatası', msg);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Valoria Hotel</Text>
      <Text style={styles.subtitle}>Personel Girişi</Text>
      <TextInput
        style={styles.input}
        placeholder="E-posta"
        placeholderTextColor="rgba(255,255,255,0.5)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Şifre"
        placeholderTextColor="rgba(255,255,255,0.5)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={signIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Giriş yapılıyor...' : 'E-posta ile Giriş'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push('/auth')}
        disabled={loading}
      >
        <Text style={styles.linkButtonText}>E-posta kodu / Magic link ile giriş</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push('/auth/reset')}
        disabled={loading}
      >
        <Text style={styles.linkButtonText}>Şifremi unuttum</Text>
      </TouchableOpacity>

      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={12}
          style={styles.appleButton}
          onPress={signInWithApple}
          disabled={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a365d',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#ed8936',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  linkButton: { marginTop: 12, paddingVertical: 8, alignItems: 'center' },
  linkButtonText: { color: '#90cdf4', fontSize: 14 },
  appleButton: {
    width: '100%',
    height: 52,
    marginTop: 16,
  },
});
