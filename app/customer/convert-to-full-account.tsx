import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { log } from '@/lib/logger';
import { getOrCreateGuestForCurrentSession } from '@/lib/getOrCreateGuestForCaller';
import {
  confirmEmailChangeWithOtp,
  resendEmailChangeCode,
  syncGuestRowWithAuthUser,
} from '@/lib/emailChangeOtp';

const CODE_LEN = 6;

type Step = 'credentials' | 'otp';

export default function ConvertToFullAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loadSession } = useAuthStore();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState((user?.email ?? '').trim());
  const [assignedGuestEmail, setAssignedGuestEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const codeRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      const g = await getOrCreateGuestForCurrentSession();
      if (!g?.guest_id) return;
      const { data } = await supabase.from('guests').select('email').eq('id', g.guest_id).maybeSingle();
      const em = (data as { email: string | null } | null)?.email?.trim();
      if (em) setAssignedGuestEmail(em);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (step === 'otp') {
      setCode('');
      setTimeout(() => codeRef.current?.focus(), 300);
    }
  }, [step]);

  const sendVerificationRequest = async () => {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      Alert.alert(t('error'), t('convertToFullAccountEmailRequired'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('error'), t('passwordMinLength'));
      return;
    }
    if (password !== password2) {
      Alert.alert(t('error'), t('passwordsDontMatch'));
      return;
    }
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({
        email: emailTrim,
        password,
      });
      if (authErr) throw authErr;
      await loadSession();
      setPendingEmail(emailTrim);
      setStep('otp');
      Alert.alert(t('info'), t('convertToFullAccountCodeSent', { email: emailTrim }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('convertToFullAccountFailed');
      log.error('ConvertToFullAccount', 'updateUser', e);
      Alert.alert(t('error'), message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const digits = code.replace(/\D/g, '');
    if (digits.length !== CODE_LEN) {
      Alert.alert(t('error'), t('enterSixDigitCode'));
      return;
    }
    setLoading(true);
    try {
      const { error: otpErr } = await confirmEmailChangeWithOtp(pendingEmail, digits);
      if (otpErr) throw otpErr;
      await loadSession();
      await syncGuestRowWithAuthUser(useAuthStore.getState().user);
      Alert.alert(t('convertToFullAccountVerifiedTitle'), t('convertToFullAccountVerifiedBody'), [
        { text: t('ok'), onPress: () => router.replace('/customer/profile') },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('convertToFullAccountOtpFailed');
      log.error('ConvertToFullAccount', 'verifyOtp', e);
      Alert.alert(t('error'), message);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    try {
      const { error } = await resendEmailChangeCode(pendingEmail);
      if (error) throw error;
      Alert.alert(t('info'), t('convertToFullAccountCodeSent', { email: pendingEmail }));
    } catch (e: unknown) {
      Alert.alert(t('error'), (e as Error)?.message ?? t('convertToFullAccountResendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const onCodeChange = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, CODE_LEN);
    setCode(d);
    if (d.length === CODE_LEN) Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('screenConvertToFullAccount')}</Text>
        <Text style={styles.intro}>{t('convertToFullAccountIntro')}</Text>
        {assignedGuestEmail ? (
          <Text style={styles.assignedEmail}>
            {t('convertToFullAccountAssignedEmail', { email: assignedGuestEmail })}
          </Text>
        ) : null}

        {step === 'credentials' ? (
          <>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />

            <Text style={styles.label}>{t('passwordPlaceholder')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />

            <Text style={styles.label}>{t('convertToFullAccountPasswordConfirm')}</Text>
            <TextInput
              style={styles.input}
              value={password2}
              onChangeText={setPassword2}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={sendVerificationRequest}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{t('convertToFullAccountRequestCode')}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.otpHint}>{t('convertToFullAccountOtpHint', { email: pendingEmail })}</Text>
            <Text style={styles.label}>{t('convertToFullAccountOtpLabel')}</Text>
            <TextInput
              ref={codeRef}
              style={[styles.input, styles.otpInput]}
              value={code}
              onChangeText={onCodeChange}
              keyboardType="number-pad"
              maxLength={CODE_LEN}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={verifyCode}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{t('convertToFullAccountVerifyEmail')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={resendCode} disabled={loading}>
              <Text style={styles.linkText}>{t('convertToFullAccountResendCode')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => {
                setStep('credentials');
                setCode('');
              }}
              disabled={loading}
            >
              <Text style={styles.linkTextSecondary}>{t('convertToFullAccountBackEdit')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  scroll: { paddingHorizontal: 20, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  intro: { fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22, marginBottom: 12 },
  assignedEmail: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  otpHint: { fontSize: 15, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  otpInput: { fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  btn: {
    marginTop: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.75 },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  linkBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  linkTextSecondary: { fontSize: 14, color: theme.colors.textSecondary },
});
