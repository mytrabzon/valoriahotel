import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuestFlowStore } from '@/stores/guestFlowStore';
import { supabase } from '@/lib/supabase';

const COLORS = {
  bg: '#f5f6f8',
  card: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  accent: '#0ea5e9',
  success: '#059669',
  cardBorder: '#e8eaed',
};

const DEFAULT_GOOGLE_PLAY = 'https://play.google.com/store/apps';
const DEFAULT_APP_STORE = 'https://apps.apple.com';

export default function SuccessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reset } = useGuestFlowStore();

  const [googlePlayUrl, setGooglePlayUrl] = useState<string>('');
  const [appStoreUrl, setAppStoreUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['google_play_url', 'app_store_url']);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: { key: string; value: unknown }) => {
        const v = r.value;
        map[r.key] = v != null && v !== '' ? String(v).trim() : '';
      });
      setGooglePlayUrl(map.google_play_url ?? '');
      setAppStoreUrl(map.app_store_url ?? '');
      setLoading(false);
    })();
  }, []);

  const openUrl = (url: string) => {
    const toOpen = url || (Platform.OS === 'android' ? DEFAULT_GOOGLE_PLAY : DEFAULT_APP_STORE);
    Linking.openURL(toOpen).catch(() => {});
  };

  const done = () => {
    reset();
    router.replace('/');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>✓</Text>
      </View>
      <Text style={styles.title}>{t('success')}</Text>
      <Text style={styles.subtitle}>{t('successDesc')}</Text>

      {loading ? (
        <ActivityIndicator size="small" color={COLORS.accent} style={styles.loader} />
      ) : (
        <View style={styles.storeSection}>
          <Text style={styles.storeSectionTitle}>Uygulamayı indir</Text>
          <Text style={styles.storeSectionSubtitle}>
            Otele özel uygulama ile iletişim ve hizmetlere kolayca ulaşın.
          </Text>
          <View style={styles.storeCards}>
            <TouchableOpacity
              style={styles.storeCard}
              onPress={() => openUrl(googlePlayUrl || DEFAULT_GOOGLE_PLAY)}
              activeOpacity={0.85}
            >
              <View style={styles.storeIconWrap}>
                <Text style={styles.storeIcon}>▶</Text>
              </View>
              <Text style={styles.storeTitle}>Google Play</Text>
              <Text style={styles.storeSubtitle}>Android</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.storeCard}
              onPress={() => openUrl(appStoreUrl || DEFAULT_APP_STORE)}
              activeOpacity={0.85}
            >
              <View style={styles.storeIconWrap}>
                <Text style={styles.storeIcon}>◆</Text>
              </View>
              <Text style={styles.storeTitle}>App Store</Text>
              <Text style={styles.storeSubtitle}>iPhone / iPad</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={done} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Tamam</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.success + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: { fontSize: 40, color: COLORS.success, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  loader: { marginBottom: 24 },
  storeSection: {
    width: '100%',
    marginBottom: 32,
  },
  storeSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  storeSectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  storeCards: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  storeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    minWidth: 140,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  storeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  storeIcon: { fontSize: 22, color: COLORS.accent, fontWeight: '700' },
  storeTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  storeSubtitle: { fontSize: 13, color: COLORS.textSecondary },
  storeHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
