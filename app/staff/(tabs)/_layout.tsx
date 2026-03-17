import { useCallback } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Tabs, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { useStaffUnreadMessagesStore } from '@/stores/staffUnreadMessagesStore';
import { useStaffNotificationStore } from '@/stores/staffNotificationStore';

const TAB_ICON_SIZE = 24;

function NotificationBellHeaderButton() {
  const router = useRouter();
  const unreadCount = useStaffNotificationStore((s) => s.unreadCount);
  return (
    <TouchableOpacity
      onPress={() => router.push('/staff/notifications')}
      style={{ marginRight: 16, padding: 4 }}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View>
        <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
        {unreadCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: theme.colors.error,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function StaffTabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;
  const tabBarPaddingBottom = Math.max(insets.bottom, 8);
  const staff = useAuthStore((s) => s.staff);
  const unreadCount = useStaffUnreadMessagesStore((s) => s.unreadCount);
  const refreshNotifications = useStaffNotificationStore((s) => s.refresh);

  useFocusEffect(
    useCallback(() => {
      if (!staff?.id) return () => {};
      refreshNotifications();
      const interval = setInterval(refreshNotifications, 180000);
      return () => clearInterval(interval);
    }, [staff?.id, refreshNotifications])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderLight,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: tabBarPaddingBottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderLight,
        },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
        headerRight: () => <NotificationBellHeaderButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('staffTab'),
          headerTitle: t('staffTab'),
          tabBarLabel: t('staffTab'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messages'),
          headerTitle: t('teamChat'),
          tabBarLabel: t('messages'),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: t('stockTab'),
          headerTitle: t('stockManagement'),
          tabBarLabel: t('stockTab'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="acceptances"
        options={{
          title: 'Onaylar',
          headerTitle: 'Sözleşme onayları – Oda ataması',
          tabBarLabel: 'Onaylar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('notifications'),
          headerTitle: t('notifications'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="misafir"
        options={{
          title: t('guestTab'),
          headerTitle: t('guestAppTitle'),
          tabBarLabel: t('guestTab'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'phone-portrait' : 'phone-portrait-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
          href: staff?.role === 'admin' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('adminTab'),
          headerTitle: t('managementPanel'),
          tabBarLabel: t('adminTab'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'shield' : 'shield-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
          href: staff?.role === 'admin' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('myProfile'),
          headerTitle: t('myProfile'),
          tabBarShowLabel: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
