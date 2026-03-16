import { View, Text, StyleSheet } from 'react-native';
import { useIsOffline } from '@/hooks/useNetworkStatus';

export function OfflineBanner() {
  const isOffline = useIsOffline();
  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>İnternet bağlantısı yok</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#c53030',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
