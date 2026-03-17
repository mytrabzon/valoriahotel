import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type VerificationBadgeType = 'blue' | 'yellow' | null | undefined;

/** TikTok tarzı mavi/sarı tik boyutu: isim yanında ~14px */
const BADGE_SIZE = 14;

const COLORS = {
  blue: '#0095F6',
  yellow: '#FFC107',
} as const;

type AvatarWithBadgeProps = {
  badge: VerificationBadgeType;
  /** Avatar daire boyutu (örn. 44, 56) */
  avatarSize?: number;
  /** Avatar üzerindeki tik boyutu */
  badgeSize?: number;
  children: React.ReactNode;
  style?: object;
};

/** Avatar üzerinde sağ alt köşede mavi/sarı tik (isim yanında + avatar üzerinde her yerde görünsün) */
export function AvatarWithBadge({ badge, avatarSize = 44, badgeSize = 14, children, style }: AvatarWithBadgeProps) {
  const hasBadge = badge === 'blue' || badge === 'yellow';
  return (
    <View style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }, style]}>
      {children}
      {hasBadge ? (
        <View style={[styles.avatarBadge, { right: -2, bottom: -2 }]} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={badgeSize} color={COLORS[badge]} />
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  badge: VerificationBadgeType;
  /** İsimle aynı hizada olsun diye kullanılabilir (örn. 2) */
  size?: number;
  style?: object;
};

export function VerifiedBadge({ badge, size = BADGE_SIZE, style }: Props) {
  if (!badge || (badge !== 'blue' && badge !== 'yellow')) return null;
  const color = COLORS[badge];
  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={size} color={color} />
    </View>
  );
}

type NameWithBadgeProps = {
  name: string;
  badge: VerificationBadgeType;
  textStyle?: object;
  badgeSize?: number;
};

/** İsim + mavi/sarı tik satırı; her yerde tutarlı görünsün diye */
export function StaffNameWithBadge({ name, badge, textStyle, badgeSize = BADGE_SIZE }: NameWithBadgeProps) {
  return (
    <View style={styles.nameRow}>
      <Text style={textStyle} numberOfLines={1}>{name}</Text>
      <VerifiedBadge badge={badge} size={badgeSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginLeft: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
});
