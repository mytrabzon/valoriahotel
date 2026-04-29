import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { canAccessDocumentManagement } from '@/lib/staffPermissions';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';

type Item = { href: string; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string };

const ITEMS: Item[] = [
  { href: '/staff/documents/all', icon: 'documents-outline', title: 'Tüm Belgeler', subtitle: 'Arama/filtre ile liste' },
  { href: '/staff/documents/categories', icon: 'pricetags-outline', title: 'Kategoriler', subtitle: 'Kategori & alt kategori' },
  { href: '/staff/documents/pending', icon: 'time-outline', title: 'Onay Bekleyenler', subtitle: 'İncele ve onayla/reddet' },
  { href: '/staff/documents/expiring', icon: 'alert-circle-outline', title: 'Süresi Yaklaşanlar', subtitle: 'Yakında bitecek belgeler' },
  { href: '/staff/documents/expired', icon: 'close-circle-outline', title: 'Süresi Dolanlar', subtitle: 'Süresi geçmiş belgeler' },
  { href: '/staff/documents/archive', icon: 'archive-outline', title: 'Arşiv', subtitle: 'Arşivlenen belgeler' },
  { href: '/staff/documents/logs', icon: 'list-outline', title: 'Log Kayıtları', subtitle: 'Kim ne yaptı?' },
  { href: '/staff/documents/settings', icon: 'settings-outline', title: 'Ayarlar', subtitle: 'Modül ayarları' },
];

export default function StaffDocumentsHome() {
  const router = useRouter();
  const staff = useAuthStore((s) => s.staff);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    totalActive: 0,
    pendingApprovals: 0,
    expiringSoon: 0,
    archived: 0,
  });

  if (!canAccessDocumentManagement(staff)) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={44} color={theme.colors.textMuted} />
        <Text style={styles.title}>Erişim yok</Text>
        <Text style={styles.sub}>Doküman yükleme/yönetim yetkiniz bulunmuyor.</Text>
      </View>
    );
  }

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [totalActiveRes, pendingRes, expiringRes, archivedRes] = await Promise.all([
      supabase.from('documents').select('id', { count: 'exact', head: true }).is('archived_at', null),
      supabase.from('document_approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .not('expiry_date', 'is', null)
        .gte('expiry_date', todayStr)
        .lte('expiry_date', in30),
      supabase.from('documents').select('id', { count: 'exact', head: true }).not('archived_at', 'is', null),
    ]);

    setCounts({
      totalActive: totalActiveRes.count ?? 0,
      pendingApprovals: pendingRes.count ?? 0,
      expiringSoon: expiringRes.count ?? 0,
      archived: archivedRes.count ?? 0,
    });
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const quickCards = useMemo(
    () => [
      { key: 'total', title: 'Toplam', value: counts.totalActive, icon: 'documents-outline' as const, href: '/staff/documents/all' },
      { key: 'pending', title: 'Onay', value: counts.pendingApprovals, icon: 'time-outline' as const, href: '/staff/documents/pending' },
      { key: 'expiring', title: 'Yaklaşan', value: counts.expiringSoon, icon: 'alert-circle-outline' as const, href: '/staff/documents/expiring' },
      { key: 'archive', title: 'Arşiv', value: counts.archived, icon: 'archive-outline' as const, href: '/staff/documents/archive' },
    ],
    [counts],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>DOKÜMAN YÖNETİMİ</Text>
        <Text style={styles.heroTitle}>Belgeleri tek yerde topla, takip et.</Text>
        <Text style={styles.heroSub}>Kategori · yetki · onay · versiyon · log</Text>

        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.primaryCta} activeOpacity={0.9} onPress={() => router.push('/staff/documents/new' as never)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.primaryCtaText}>Belge Yükle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryCta} activeOpacity={0.85} onPress={load}>
            {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="refresh" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.grid}>
        {quickCards.map((c) => (
          <TouchableOpacity key={c.key} style={styles.metricCard} activeOpacity={0.85} onPress={() => router.push(c.href as never)}>
            <View style={styles.metricIcon}>
              <Ionicons name={c.icon} size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.metricTitle}>{c.title}</Text>
              <Text style={styles.metricValue}>{loading ? '—' : String(c.value)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        {ITEMS.map((it, idx) => {
          const isLast = idx === ITEMS.length - 1;
          return (
            <TouchableOpacity
              key={it.href}
              style={[styles.row, !isLast && styles.rowBorder]}
              activeOpacity={0.75}
              onPress={() => router.push(it.href as never)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={it.icon} size={22} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>{it.title}</Text>
                {it.subtitle ? <Text style={styles.rowSub}>{it.subtitle}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: theme.spacing.lg, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.backgroundSecondary },
  title: { marginTop: 12, fontSize: 18, fontWeight: '800', color: theme.colors.text },
  sub: { marginTop: 8, fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, textAlign: 'center', lineHeight: 18 },
  hero: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 16,
    marginBottom: 14,
    ...theme.shadows.sm,
  },
  kicker: { fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 1.1 },
  heroTitle: { marginTop: 8, fontSize: 20, fontWeight: '900', color: theme.colors.text },
  heroSub: { marginTop: 6, fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  primaryCta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
  },
  primaryCtaText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryCta: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.text + '18',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metricCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  metricIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary + '14' },
  metricTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.textMuted },
  metricValue: { marginTop: 2, fontSize: 18, fontWeight: '900', color: theme.colors.text },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderLight },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  rowSub: { marginTop: 2, fontSize: 13, color: theme.colors.textMuted },
});

