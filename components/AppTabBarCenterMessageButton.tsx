import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { theme } from '@/constants/theme';
import { pds } from '@/constants/personelDesignSystem';
import { appTabBar } from '@/constants/tabBarTheme';

const { size: MSG_SIZE, icon: MSG_ICON, lift: MSG_LIFT } = appTabBar.centerMessage;

const styles = StyleSheet.create({
  tabBtn: {
    width: MSG_SIZE + 12,
    height: MSG_SIZE + 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  elevate: {
    position: 'relative',
    marginTop: MSG_LIFT,
    /* Android: elevation sarmalayıcıda kare gölge “kutucuğu” üretiyor; gölgeyi dairede bırak. */
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: {},
      default: {},
    }),
  },
  circle: {
    width: MSG_SIZE,
    height: MSG_SIZE,
    borderRadius: MSG_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
  circleDim: { opacity: 0.75 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});

type Props = BottomTabBarButtonProps & {
  unreadCount: number;
  accessibilityLabel: string;
};

export function AppTabBarCenterMessageButton({ accessibilityLabel, unreadCount, style, onPress, accessibilityState, testID, href }: Props) {
  const focused = !!accessibilityState?.selected;

  return (
    <TouchableOpacity
      style={[style, styles.tabBtn, Platform.OS === 'android' && { borderWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.88}
      testID={testID}
      href={href}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.elevate}>
        <LinearGradient
          colors={pds.gradientPremium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.circle, !focused && styles.circleDim]}
        >
          <Ionicons name="paper-plane" size={MSG_ICON} color="#fff" />
        </LinearGradient>
        {unreadCount > 0 ? (
          <View style={styles.badge} pointerEvents="none">
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
