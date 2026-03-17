import { useEffect } from 'react';
import { View, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { adminTheme } from '@/constants/adminTheme';
import { Ionicons } from '@expo/vector-icons';

export default function AdminLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleAdminBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      // Admin giriş yapmış kullanıcı; lobi yerine doğrudan personel paneline dön
      router.replace('/staff');
    }
  };
  const { staff, loading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!staff || staff.role !== 'admin') {
      router.replace('/');
      return;
    }
  }, [loading, staff]);

  const headerOpts = {
    headerStyle: {
      backgroundColor: '#fff',
    },
    headerTintColor: adminTheme.colors.text,
    headerTitleStyle: {
      fontWeight: '700' as const,
      fontSize: 17,
    },
    headerShadowVisible: true,
    contentStyle: { paddingBottom: insets.bottom + 16 },
    ...(Platform.OS === 'android' && {
      statusBarColor: '#fff',
    }),
  };

  return (
    <View style={styles.wrapper}>
      <Stack screenOptions={{ headerShown: true, ...headerOpts }}>
        <Stack.Screen
          name="index"
          options={{
            title: t('managementPanel'),
            headerLeft: () => (
              <TouchableOpacity
                onPress={handleAdminBack}
                style={{ marginLeft: 8, padding: 8 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="arrow-back" size={24} color={adminTheme.colors.text} />
              </TouchableOpacity>
            ),
          }}
        />
      <Stack.Screen name="rooms/index" options={{ title: t('adminRooms') }} />
      <Stack.Screen name="rooms/[id]" options={{ title: t('adminRoomDetail') }} />
      <Stack.Screen name="rooms/new" options={{ title: t('adminRoomNew') }} />
      <Stack.Screen name="guests/index" options={{ title: t('adminGuests') }} />
      <Stack.Screen name="guests/[id]" options={{ title: t('adminGuestDetail') }} />
      <Stack.Screen name="checkin" options={{ title: t('adminCheckin') }} />
      <Stack.Screen name="housekeeping" options={{ title: t('adminHousekeeping') }} />
      <Stack.Screen name="report" options={{ title: t('adminReport') }} />
      <Stack.Screen name="hmb-reports/index" options={{ title: t('adminHmbReports') }} />
      <Stack.Screen name="contracts" options={{ title: t('adminContracts'), headerShown: false }} />
      <Stack.Screen name="stock/index" options={{ headerShown: false }} />
      <Stack.Screen name="stock/product/[id]" options={{ title: t('adminProductDetail') }} />
      <Stack.Screen name="stock/movement" options={{ title: t('adminStockMovement') }} />
      <Stack.Screen name="stock/approvals" options={{ title: t('adminStockApprovals') }} />
      <Stack.Screen name="stock/scan" options={{ title: t('adminScanBarcode'), headerShown: false }} />
      <Stack.Screen name="expenses/index" options={{ title: 'Harcama yönetimi' }} />
      <Stack.Screen name="expenses/by-category" options={{ title: 'Kategori bazlı harcama' }} />
      <Stack.Screen name="expenses/by-staff" options={{ title: 'Personel bazlı harcama' }} />
      <Stack.Screen name="salary/index" options={{ title: 'Maaş yönetimi' }} />
      <Stack.Screen name="salary/new" options={{ title: 'Yeni maaş ödemesi' }} />
      <Stack.Screen name="salary/history/[id]" options={{ title: 'Maaş geçmişi' }} />
      <Stack.Screen name="salary/edit/[paymentId]" options={{ title: 'Maaş düzenle' }} />
      <Stack.Screen name="access/index" options={{ title: t('adminAccess') }} />
      <Stack.Screen name="access/doors" options={{ title: t('adminDoors') }} />
      <Stack.Screen name="access/doors/new" options={{ title: t('adminDoorNew') }} />
      <Stack.Screen name="access/doors/[id]" options={{ title: t('adminDoorEdit') }} />
      <Stack.Screen name="access/cards" options={{ title: t('adminCards') }} />
      <Stack.Screen name="access/cards/new" options={{ title: t('adminCardNew') }} />
      <Stack.Screen name="access/cards/[id]" options={{ title: t('adminCardEdit') }} />
      <Stack.Screen name="access/staff-permissions" options={{ title: t('adminStaffPermissions') }} />
      <Stack.Screen name="access/logs" options={{ title: t('adminAccessLogs') }} />
      <Stack.Screen name="permissions" options={{ title: t('adminPermissions') }} />
      <Stack.Screen name="notifications/index" options={{ title: t('adminNotifications') }} />
      <Stack.Screen name="notifications/bulk" options={{ title: t('adminBulkNotification') }} />
      <Stack.Screen name="reports/index" options={{ title: t('adminReports') }} />
      <Stack.Screen name="notifications/templates" options={{ title: t('adminNotificationTemplates') }} />
      <Stack.Screen name="notifications/emergency" options={{ title: t('adminEmergency') }} />
      <Stack.Screen name="messages/index" options={{ title: t('adminMessages') }} />
      <Stack.Screen name="messages/chat/[id]" options={{ title: t('adminChat') }} />
      <Stack.Screen name="messages/new" options={{ title: t('adminNewChat') }} />
      <Stack.Screen name="messages/bulk" options={{ title: t('adminBulkMessage') }} />
      <Stack.Screen name="staff/index" options={{ title: t('adminStaffCreate') }} />
      <Stack.Screen name="staff/list" options={{ title: t('adminUserList') }} />
      <Stack.Screen name="staff/[id]" options={{ title: t('adminStaffEdit') }} />
      <Stack.Screen name="staff/add" options={{ title: t('adminStaffAdd') }} />
      <Stack.Screen name="staff/pending" options={{ title: t('adminStaffPending') }} />
      <Stack.Screen name="staff/approve/[id]" options={{ title: t('adminStaffApprove') }} />
      <Stack.Screen name="qr-designs/index" options={{ title: t('adminQrDesigns') }} />
      </Stack>

      {/* Tab menü: Admin, Personel, Misafir — hepsi tab’ta, ayrı yerde olmayacak */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
});
