import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { adminTheme } from '@/constants/adminTheme';
import { AdminCard } from '@/components/admin';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';

type Item = { href: string; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string };

const ITEMS: Item[] = [
  { href: '/admin/documents/all', icon: 'documents-outline', title: 'Tüm Belgeler', subtitle: 'Arama/filtre ile liste' },
  { href: '/admin/documents/categories', icon: 'pricetags-outline', title: 'Kategoriler', subtitle: 'Kategori & alt kategori' },
  { href: '/admin/documents/pending', icon: 'time-outline', title: 'Onay Bekleyenler', subtitle: 'İncele ve onayla/reddet' },
  { href: '/admin/documents/expiring', icon: 'alert-circle-outline', title: 'Süresi Yaklaşanlar', subtitle: 'Yakında bitecek belgeler' },
  { href: '/admin/documents/expired', icon: 'close-circle-outline', title: 'Süresi Dolanlar', subtitle: 'Süresi geçmiş belgeler' },
  { href: '/admin/documents/archive', icon: 'archive-outline', title: 'Arşiv', subtitle: 'Arşivlenen belgeler' },
  { href: '/admin/documents/logs', icon: 'list-outline', title: 'Log Kayıtları', subtitle: 'Kim ne yaptı?' },
  { href: '/admin/documents/settings', icon: 'settings-outline', title: 'Ayarlar', subtitle: 'Modül ayarları' },
];

export default function AdminDocumentsHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    totalActive: 0,
    pendingApprovals: 0,
    expiringSoon: 0,
    archived: 0,
  });
  const [recent, setRecent] = useState<Array<{ id: string; title: string; updated_at: string; status: string | null }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [totalActiveRes, pendingRes, expiringRes, archivedRes, recentRes] = await Promise.all([
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
      supabase.from('documents').select('id, title, updated_at, status').order('updated_at', { ascending: false }).limit(6),
    ]);

    setCounts({
      totalActive: totalActiveRes.count ?? 0,
      pendingApprovals: pendingRes.count ?? 0,
      expiringSoon: expiringRes.count ?? 0,
      archived: archivedRes.count ?? 0,
    });

    if (!recentRes.error && recentRes.data) setRecent(recentRes.data as any);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const quickCards = useMemo(
    () => [
      {
        key: 'total',
        title: 'Toplam',
        value: counts.totalActive,
        icon: 'documents-outline' as const,
        href: '/admin/documents/all',
        tone: 'blue' as const,
      },
      {
        key: 'pending',
        title: 'Onay',
        value: counts.pendingApprovals,
        icon: 'time-outline' as const,
        href: '/admin/documents/pending',
        tone: 'amber' as const,
      },
      {
        key: 'expiring',
        title: 'Yaklaşan',
        value: counts.expiringSoon,
        icon: 'alert-circle-outline' as const,
        href: '/admin/documents/expiring',
        tone: 'green' as const,
      },
      {
        key: 'archive',
        title: 'Arşiv',
        value: counts.archived,
        icon: 'archive-outline' as const,
        href: '/admin/documents/archive',
        tone: 'gray' as const,
      },
    ],
    [counts],
  );

  const toneStyles = useMemo(() => {
    return {
      blue: { bg: '#E8F2FF', fg: '#1D4ED8' },
      amber: { bg: '#FFF6E7', fg: '#B45309' },
      green: { bg: '#E9F8EF', fg: '#15803D' },
      gray: { bg: '#EEF2F6', fg: '#334155' },
    } as const;
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#0b1324', '#112b3c', '#2a5b4a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroKicker}>DOKÜMAN YÖNETİMİ</Text>
        <Text style={styles.heroTitle}>Belgeleri tek yerde topla, takip et.</Text>
        <Text style={styles.heroSub}>Kategori · yetki · onay · versiyon · log</Text>

        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.primaryCta} activeOpacity={0.9} onPress={() => router.push('/admin/documents/new' as never)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.primaryCtaText}>Belge Yükle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryCta} activeOpacity={0.85} onPress={load}>
            {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="refresh" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.grid}>
        {quickCards.map((c) => {
          const tone = toneStyles[c.tone];
          return (
            <TouchableOpacity key={c.key} style={styles.metricCard} activeOpacity={0.85} onPress={() => router.push(c.href as never)}>
              <View style={[styles.metricIcon, { backgroundColor: tone.bg }]}>
                <Ionicons name={c.icon} size={20} color={tone.fg} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.metricTitle}>{c.title}</Text>
                <Text style={styles.metricValue}>{loading ? '—' : String(c.value)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <AdminCard padded={false} elevated>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Son güncellenenler</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/admin/documents/all' as never)}>
            <Text style={styles.sectionLink}>Tümünü gör</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.list}>
          {recent.length === 0 ? (
            <Text style={styles.emptyRecent}>{loading ? 'Yükleniyor…' : 'Henüz belge yok'}</Text>
          ) : (
            recent.map((r, idx) => {
              const isLast = idx === recent.length - 1;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.row, !isLast && styles.rowBorder]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/admin/documents/${r.id}` as never)}
                >
                  <View style={styles.iconWrap}>
                    <Ionicons name="document-text-outline" size={20} color={adminTheme.colors.primaryMuted} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {new Date(r.updated_at).toLocaleString('tr-TR')} · {r.status ?? '-'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={adminTheme.colors.textMuted} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </AdminCard>

      <AdminCard padded={false} elevated>
        <View style={styles.list}>
          {ITEMS.map((it, idx) => {
            const isLast = idx === ITEMS.length - 1;
            return (
              <TouchableOpacity
                key={it.href}
                style={[styles.row, !isLast && styles.rowBorder]}
                activeOpacity={0.7}
                onPress={() => router.push(it.href as never)}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={it.icon} size={22} color={adminTheme.colors.primaryMuted} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title}>{it.title}</Text>
                  {it.subtitle ? (
                    <Text style={styles.sub} numberOfLines={2}>
                      {it.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={adminTheme.colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      </AdminCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  hero: {
    borderRadius: adminTheme.radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...((Platform.OS === 'ios' ? adminTheme.shadow.sm : { elevation: 3 }) as ViewStyle),
  },
  heroKicker: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.70)', letterSpacing: 1.1 },
  heroTitle: { marginTop: 8, fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },
  heroSub: { marginTop: 6, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.78)' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  primaryCta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  primaryCtaText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryCta: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metricCard: {
    width: '48%',
    backgroundColor: adminTheme.colors.surface,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  metricIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricTitle: { fontSize: 12, fontWeight: '800', color: adminTheme.colors.textMuted },
  metricValue: { marginTop: 2, fontSize: 18, fontWeight: '900', color: adminTheme.colors.text },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: adminTheme.spacing.lg, paddingTop: 14, paddingBottom: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: adminTheme.colors.text },
  sectionLink: { fontSize: 12, fontWeight: '800', color: adminTheme.colors.primaryMuted },
  emptyRecent: { paddingHorizontal: adminTheme.spacing.lg, paddingBottom: 14, fontSize: 13, fontWeight: '700', color: adminTheme.colors.textMuted },
  list: { paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: adminTheme.spacing.lg, minHeight: 56 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: adminTheme.colors.borderLight },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: adminTheme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: { fontSize: 15, fontWeight: '700', color: adminTheme.colors.text },
  sub: { marginTop: 2, fontSize: 12, fontWeight: '600', color: adminTheme.colors.textMuted, lineHeight: 16 },
});

