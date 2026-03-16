import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function CustomerProfile() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.subtitle}>Müşteri uygulaması — giriş yapmadan kullanıyorsunuz.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('legalAndContact')}</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/legal/privacy')}>
          <Text style={styles.linkText}>📄 {t('privacyPolicy')}</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/legal/terms')}>
          <Text style={styles.linkText}>📋 {t('termsOfService')}</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/legal/cookies')}>
          <Text style={styles.linkText}>🍪 {t('cookiePolicy')}</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
        <Text style={styles.contactLabel}>{t('contact')}: support@valoriahotel.com</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#374151' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  linkText: { fontSize: 15, color: '#1a365d' },
  linkArrow: { fontSize: 16, color: '#9ca3af' },
  contactLabel: { fontSize: 14, color: '#6b7280', marginTop: 16 },
});
