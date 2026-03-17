import { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminTheme } from '@/constants/adminTheme';
import { AdminCard } from '@/components/admin';

function MethodCard({
  emoji,
  title,
  description,
  cta,
  onPress,
}: {
  emoji: string;
  title: string;
  description: string;
  cta: string;
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
    <Animated.View style={{ transform: [{ scale }], marginBottom: 14 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.card}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{description}</Text>
        <View style={styles.ctaRow}>
          <Text style={styles.cta}>{cta}</Text>
          <Ionicons name="arrow-forward" size={18} color={adminTheme.colors.accent} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function StaffHubScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Çalışan hesabı oluşturma</Text>
        <Text style={styles.sectionDesc}>İki yöntemden birini kullanın</Text>
      </View>

      <MethodCard
        emoji="👑"
        title="Yöntem 1: Admin eklesin"
        description="Her şeyi siz doldurun, tam kontrol. Profil fotoğrafı, kişisel ve çalışan bilgileri, yetkiler."
        cta="Yeni çalışan ekle"
        onPress={() => router.push('/admin/staff/add')}
      />

      <MethodCard
        emoji="👤"
        title="Yöntem 2: Çalışan kaydolsun"
        description="Çalışan kendi başvurusunu yapar, siz onaylarken düzenleyip yetkileri verirsiniz."
        cta="Onay bekleyen başvurular"
        onPress={() => router.push('/admin/staff/pending')}
      />

      <MethodCard
        emoji="📋"
        title="Kullanıcılar listesi"
        description="Tüm çalışanları ve kullanıcıları görüntüleyin (admin)."
        cta="Listeyi aç"
        onPress={() => router.push('/admin/staff/list')}
      />

      <AdminCard style={styles.footer} padded>
        <Text style={styles.footerText}>
          Önerilen: Çalışan kendi kaydolsun, siz onaylayıp yetkileri atayın.
        </Text>
      </AdminCard>
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
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: adminTheme.colors.text,
  },
  sectionDesc: {
    fontSize: 14,
    color: adminTheme.colors.textSecondary,
    marginTop: 6,
  },
  card: {
    backgroundColor: adminTheme.colors.surface,
    padding: 20,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    ...Platform.select({
      ios: adminTheme.shadow.sm,
      android: { elevation: 2 },
    }),
  },
  emoji: {
    fontSize: 28,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: adminTheme.colors.text,
  },
  cardDesc: {
    fontSize: 14,
    color: adminTheme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 22,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  cta: {
    fontSize: 14,
    fontWeight: '600',
    color: adminTheme.colors.accent,
  },
  footer: {
    marginTop: 20,
    backgroundColor: adminTheme.colors.infoLight,
    borderColor: adminTheme.colors.info,
  },
  footerText: {
    fontSize: 13,
    color: adminTheme.colors.info,
    textAlign: 'center',
  },
});
