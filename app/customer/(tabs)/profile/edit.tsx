import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';

function getInitialName(): string {
  const { user } = useAuthStore.getState();
  if (!user) return '';
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (name && typeof name === 'string') return name.trim();
  return '';
}

function getInitialPhone(): string {
  const { user } = useAuthStore.getState();
  if (!user) return '';
  const phone = user.user_metadata?.phone;
  if (phone && typeof phone === 'string') return phone.trim();
  return '';
}

function getInitialWhatsApp(): string {
  const { user } = useAuthStore.getState();
  if (!user) return '';
  const whatsapp = user.user_metadata?.whatsapp;
  if (whatsapp && typeof whatsapp === 'string') return whatsapp.trim();
  return '';
}

export default function CustomerProfileEdit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loadSession } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(getInitialName());
    setPhone(getInitialPhone());
    setWhatsapp(getInitialWhatsApp());
  }, [user?.id]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Hata', 'Giriş yapmanız gerekiyor.');
      return;
    }
    const nameTrim = fullName.trim();
    if (!nameTrim) {
      Alert.alert('Eksik bilgi', 'Ad soyad alanı zorunludur.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: nameTrim,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
        },
      });
      if (error) throw error;
      await loadSession();
      Alert.alert('Kaydedildi', 'Profil bilgileriniz güncellendi.', [
        { text: 'Tamam', onPress: () => router.replace('/customer/profile') },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Profil güncellenemedi.';
      Alert.alert('Hata', message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.placeholderText}>Profil düzenlemek için giriş yapın.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/auth')} activeOpacity={0.85}>
          <Ionicons name="person-add-outline" size={22} color={theme.colors.white} style={{ marginRight: 10 }} />
          <Text style={styles.primaryButtonText}>Giriş yap</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil bilgileri</Text>
          <Text style={styles.label}>Ad soyad</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Adınız ve soyadınız"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
            editable={!saving}
          />
          <Text style={[styles.label, { marginTop: 16 }]}>Telefon (isteğe bağlı)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+90 5XX XXX XX XX"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="phone-pad"
            editable={!saving}
          />
          <Text style={[styles.label, { marginTop: 16 }]}>WhatsApp (isteğe bağlı)</Text>
          <TextInput
            style={styles.input}
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="05551234567"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="phone-pad"
            editable={!saving}
          />
          <Text style={styles.emailReadOnly}>E-posta: {user.email ?? (user.user_metadata?.email as string) ?? '—'}</Text>
          <Text style={styles.hint}>E-posta adresi güvenlik nedeniyle buradan değiştirilemez.</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color={theme.colors.white} style={{ marginRight: 10 }} />
              <Text style={styles.primaryButtonText}>Kaydet</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: theme.spacing.lg },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  emailReadOnly: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 6,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: theme.colors.white },
  placeholderText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
});
