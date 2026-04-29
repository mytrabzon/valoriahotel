import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SharedAppLinks } from '@/components/SharedAppLinks';
import { theme } from '@/constants/theme';

/**
 * Yönetimin paylaştığı uygulama mağazası ve web site linklerinin listesi.
 */
export default function StaffProfileAppLinksScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <SharedAppLinks layout="page" showManageButton />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
