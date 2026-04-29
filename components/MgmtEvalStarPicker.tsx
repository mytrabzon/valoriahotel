import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
};

export function MgmtEvalStarPicker({ label, value, onChange, disabled }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => !disabled && onChange(n)}
            disabled={disabled}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            activeOpacity={0.7}
          >
            <Text style={[styles.star, n <= value && styles.starOn]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  stars: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  star: { fontSize: 26, color: theme.colors.borderLight },
  starOn: { color: '#f59e0b' },
});
