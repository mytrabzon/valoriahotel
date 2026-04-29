import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { pds } from '@/constants/personelDesignSystem';

/* Android: küçük tab yüksekliğinde 64pt taşar ve gölge “kutu” bırakır. */
const FAB = Platform.OS === 'android' ? 52 : 58;
const LIFT = Platform.OS === 'android' ? -4 : -6;
const ICON = Platform.OS === 'android' ? 26 : 28;

type Props = Pick<BottomTabBarButtonProps, 'style' | 'onPress' | 'accessibilityState' | 'testID' | 'children'>;

/**
 * Orta sekme: gradient FAB — personelde mesaj sekmesinin yerine; basınca hızlı işlemler açılır.
 */
export function AppTabBarCenterFabButton({ style, onPress, accessibilityState, testID, children: _c }: Props) {
  return (
    <TouchableOpacity
      style={[style, styles.tabBtn]}
      onPress={onPress}
      activeOpacity={0.9}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel="Hızlı işlemler"
    >
      <View style={[styles.elevate, { marginTop: LIFT }]}>
        <LinearGradient
          colors={pds.gradientPremium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.circle}
        >
          <Ionicons name="add" size={ICON} color="#fff" />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  elevate: {
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {},
      default: {},
    }),
  },
  circle: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: 5 },
      default: {},
    }),
  },
});
