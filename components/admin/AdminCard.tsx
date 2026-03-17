import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { adminTheme } from '@/constants/adminTheme';

type AdminCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  elevated?: boolean;
};

export function AdminCard({
  children,
  style,
  padded = true,
  elevated = true,
}: AdminCardProps) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        elevated && (Platform.OS === 'ios' ? styles.shadow : styles.elevation),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: adminTheme.colors.surface,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
  },
  padded: {
    padding: adminTheme.spacing.xl,
  },
  shadow: adminTheme.shadow.md,
  elevation: { elevation: 4 },
});
