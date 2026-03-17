import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
  Platform,
} from 'react-native';
import { adminTheme } from '@/constants/adminTheme';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'secondary';

type AdminButtonProps = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
};

export function AdminButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  disabled = false,
  style,
  textStyle,
  fullWidth,
}: AdminButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };

  const isPrimary = variant === 'primary';
  const isAccent = variant === 'accent';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const isSecondary = variant === 'secondary';

  const boxStyle: ViewStyle[] = [
    styles.base,
    size === 'sm' && styles.sm,
    size === 'md' && styles.md,
    size === 'lg' && styles.lg,
    isPrimary && styles.primary,
    isAccent && styles.accent,
    isOutline && styles.outline,
    isGhost && styles.ghost,
    isSecondary && styles.secondary,
    disabled && styles.disabled,
    fullWidth && styles.fullWidth,
  ];

  const labelStyle: TextStyle[] = [
    styles.label,
    size === 'sm' && styles.labelSm,
    size === 'lg' && styles.labelLg,
    (isPrimary || isAccent) && styles.labelSolid,
    (isOutline || isSecondary) && styles.labelOutline,
    isGhost && styles.labelGhost,
  ];

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, fullWidth && { width: '100%' }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={disabled}
        style={[boxStyle, style]}
      >
        {leftIcon ? <>{leftIcon}</> : null}
        <Text style={[labelStyle, textStyle]} numberOfLines={1}>
          {title}
        </Text>
        {rightIcon ? <>{rightIcon}</> : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: adminTheme.shadow.sm,
      android: { elevation: 2 },
    }),
  },
  sm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: adminTheme.radius.sm,
  },
  md: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: adminTheme.radius.md,
  },
  lg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: adminTheme.radius.lg,
  },
  primary: {
    backgroundColor: adminTheme.button.primaryBg,
  },
  accent: {
    backgroundColor: adminTheme.button.accentBg,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: adminTheme.button.outlineBorder,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  secondary: {
    backgroundColor: adminTheme.colors.surfaceTertiary,
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  labelSm: { fontSize: 13 },
  labelLg: { fontSize: 16 },
  labelSolid: {
    color: adminTheme.button.primaryText,
  },
  labelOutline: {
    color: adminTheme.button.outlineText,
  },
  labelGhost: {
    color: adminTheme.button.ghostText,
  },
});
