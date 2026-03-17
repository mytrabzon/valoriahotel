import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Admin yetkili personel bu sekmeye tıkladığında doğrudan yönetim paneline gider.
 * Tab bar'da sadece role === 'admin' iken görünür.
 */
export default function StaffAdminTabRedirect() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      router.replace('/admin');
    }, [router])
  );

  return (
    <View style={styles.placeholder}>
      <ActivityIndicator size="large" color="#b8860b" />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
});
