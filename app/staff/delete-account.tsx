import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { invokeEdgeWithAuth } from '@/lib/invokeEdgeWithAuth';
import { theme } from '@/constants/theme';
import { useTranslation } from 'react-i18next';

export default function StaffDeleteAccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, signOut } = useAuthStore();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await invokeEdgeWithAuth('delete-user-account', {
        mode: 'self',
        password: password || undefined,
        deletion_reason: reason.trim() || undefined,
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      setDeleted(true);
      await signOut();
      setTimeout(() => router.replace('/'), 1500);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? t('deleteAccountFailed');
      Alert.alert(t('error'), msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      t('deleteAccountConfirmTitle'),
      t('deleteAccountConfirmBody'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('deleteAccountConfirmCta'), style: 'destructive', onPress: handleDelete },
      ]
    );
  };

  if (deleted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.successTitle}>{`✅ ${t('deleteAccountSuccessTitle')}`}</Text>
        <Text style={styles.successText}>{t('deleteAccountSuccessBody')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>{`⚠️ ${t('deleteAccountWarningTitle')}`}</Text>
          <Text style={styles.warningText}>
            {t('deleteAccountWarningIntro')}
          </Text>
          <Text style={styles.warningBullet}>{`• ${t('deleteAccountWarningItem1')}`}</Text>
          <Text style={styles.warningBullet}>{`• ${t('deleteAccountWarningItem2')}`}</Text>
          <Text style={styles.warningBullet}>{`• ${t('deleteAccountWarningItem3')}`}</Text>
        </View>

        <Text style={styles.label}>{t('deleteAccountPasswordLabel')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t('deleteAccountPasswordPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t('deleteAccountReasonLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder={t('deleteAccountReasonPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.deleteBtn, loading && styles.deleteBtnDisabled]}
          onPress={confirmDelete}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteBtnText}>{t('deleteAccountPrimaryCta')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  scroll: { padding: 20, paddingBottom: 40 },
  warningBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warningTitle: { fontSize: 18, fontWeight: '700', color: '#b91c1c', marginBottom: 8 },
  warningText: { fontSize: 14, color: '#991b1b', marginBottom: 6 },
  warningBullet: { fontSize: 13, color: '#991b1b', marginLeft: 8, marginBottom: 2 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    marginBottom: 20,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  deleteBtn: {
    backgroundColor: theme.colors.error,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteBtnDisabled: { opacity: 0.7 },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  successTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  successText: { fontSize: 15, color: theme.colors.textSecondary },
});
