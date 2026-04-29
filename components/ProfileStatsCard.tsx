import { View, Text, StyleSheet } from 'react-native';
import { profileScreenTheme as P } from '@/constants/profileScreenTheme';

export type ProfileStatItem = { value: string | number; label: string };

type Props = { items: ProfileStatItem[] };

export function ProfileStatsCard({ items }: Props) {
  return (
    <View style={[styles.card, P.statShadow]}>
      {items.map((it, i) => (
        <View key={`${it.label}-${i}`} style={styles.cell}>
          <Text style={styles.value} numberOfLines={1}>
            {it.value}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: P.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
    color: P.text,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: P.subtext,
    marginTop: 4,
  },
});
