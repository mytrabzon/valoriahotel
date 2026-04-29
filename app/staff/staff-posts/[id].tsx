import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '@/constants/theme';
import { StaffProfileFeedGrid } from '@/components/StaffProfileFeedGrid';
import { useAuthStore } from '@/stores/authStore';

export default function StaffMemberPostsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { staff } = useAuthStore();

  if (!id) {
    return null;
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>{t('profileFeedPostsScreenHint')}</Text>
        <StaffProfileFeedGrid
          staffId={id}
          linkVariant="staff"
          showEmptyHint
          allowOwnPostDelete={staff?.id === id}
          viewerStaffId={staff?.id ?? null}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  scroll: { paddingHorizontal: theme.spacing.lg, paddingTop: 12 },
  hint: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 12, lineHeight: 18 },
});
