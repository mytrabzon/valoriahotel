import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '@/constants/theme';

export default function GuestProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 56 }]}>
      <Text style={styles.title}>{t('guestProfileUnavailableTitle')}</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/customer')} activeOpacity={0.8}>
        <Text style={styles.backBtnText}>{t('guestProfileUnavailableBack')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  title: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
  },
  backBtnText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
