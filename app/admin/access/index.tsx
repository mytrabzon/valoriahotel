import { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminTheme } from '@/constants/adminTheme';
import { AdminCard } from '@/components/admin';

const ITEMS = [
  {
    href: '/admin/access/doors',
    icon: 'lock-open-outline' as const,
    title: 'Kapılar',
    desc: 'Oda kapıları, otopark, havuz, spor salonu, personel girişi ekle/düzenle',
  },
  {
    href: '/admin/access/cards',
    icon: 'card-outline' as const,
    title: 'Kart Tanımlama',
    desc: 'Misafir/personel kartı tanımla, geçerlilik tarihi, hangi kapılar',
  },
  {
    href: '/admin/access/staff-permissions',
    icon: 'people-outline' as const,
    title: 'Personel Yetkileri',
    desc: 'Kim hangi kapıyı hangi saatte açabilir',
  },
  {
    href: '/admin/access/logs',
    icon: 'list-outline' as const,
    title: 'Kapı Logları',
    desc: 'Kim ne zaman hangi kapıyı açtı, yetkisiz denemeler',
  },
];

function MenuCard({
  icon,
  title,
  desc,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 12 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={24} color={adminTheme.colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={adminTheme.colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AccessControlDashboard() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Geçiş Kontrol Sistemi</Text>
      <Text style={styles.subtitle}>Kapılar, kartlar ve personel yetkilerini buradan yönetin.</Text>

      {ITEMS.map((item) => (
        <MenuCard
          key={item.href}
          icon={item.icon}
          title={item.title}
          desc={item.desc}
          onPress={() => router.push(item.href)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: adminTheme.colors.surfaceSecondary,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: adminTheme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: adminTheme.colors.textSecondary,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: adminTheme.colors.surface,
    padding: 18,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    ...Platform.select({
      ios: adminTheme.shadow.sm,
      android: { elevation: 2 },
    }),
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: adminTheme.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: adminTheme.colors.text,
  },
  cardDesc: {
    fontSize: 13,
    color: adminTheme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
});
