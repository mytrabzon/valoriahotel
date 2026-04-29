import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Alert,
  type ViewStyle,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { staffListConversations } from '@/lib/messagingApi';
import { useAuthStore } from '@/stores/authStore';
import { useAdminBadgeDismissedStore } from '@/stores/adminBadgeDismissedStore';
import { adminTheme } from '@/constants/adminTheme';
import { AdminCard } from '@/components/admin';
import { isKbsUiEnabled } from '@/lib/kbsUiEnabled';

type Stats = {
  roomsTotal: number;
  roomsOccupied: number;
  guestsActive: number;
  staffActive: number;
  stockPending: number;
  staffPending: number;
  expensesPending: number;
  unreadNotifs: number;
  messagesUnread: number;
  feedTotal: number;
  reportsPending: number;
  complaintsPending: number;
  acceptancesUnassigned: number;
};

const H_PAD = 20;

type SectionItem = {
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
};

type Section = {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: SectionItem[];
};

const SECTION_TINTS: Record<string, { bg: string; icon: string }> = {
  'Konaklama & Odalar': { bg: '#ecfeff', icon: '#0e7490' },
  İletişim: { bg: '#fff7ed', icon: '#c2410c' },
  'Stok & Onaylar': { bg: '#f5f3ff', icon: '#6d28d9' },
  'Erişim & Güvenlik': { bg: '#eff6ff', icon: '#1d4ed8' },
  'Kurumsal & Ayarlar': { bg: '#f0fdf4', icon: '#166534' },
};

const SECTIONS: Section[] = [
  {
    title: 'Konaklama & Odalar',
    subtitle: 'Oda ve misafir işlemleri',
    icon: 'business-outline',
    items: [
      { href: '/admin/rooms', icon: 'bed-outline', label: 'Oda yönetimi' },
      { href: '/admin/rooms/cleaning-plan', icon: 'checkbox-outline', label: 'Yarın temizlenecek odalar' },
      { href: '/admin/rooms/new', icon: 'add-circle-outline', label: 'Yeni oda' },
      { href: '/admin/checkin', icon: 'calendar-outline', label: 'Check-in / Check-out' },
      { href: '/admin/housekeeping', icon: 'leaf-outline', label: 'Housekeeping' },
      { href: '/admin/tasks', icon: 'clipboard-outline', label: 'Personel görevleri' },
      { href: '/admin/attendance', icon: 'time-outline', label: 'Personel mesai takibi' },
      { href: '/admin/guests', icon: 'people-outline', label: 'Misafirler' },
      { href: '/admin/report', icon: 'document-text-outline', label: 'Günlük rapor' },
      { href: '/admin/stays', icon: 'bed-outline', label: 'Konaklama geçmişi' },
      { href: '/admin/sales', icon: 'cash-outline', label: 'Satış & Komisyon' },
      { href: '/admin/hmb-reports', icon: 'document-attach-outline', label: 'HMB Raporu (Maliye)' },
    ],
  },
  {
    title: 'İletişim',
    subtitle: 'Topluluk içeriği ve duyurular',
    icon: 'chatbubble-ellipses-outline',
    items: [
      { href: '/admin/feed', icon: 'images-outline', label: 'Gönderiler' },
      { href: '/admin/local-area-guide', icon: 'map-outline', label: 'Gezilecek yerler (bölge rehberi)' },
      { href: '/admin/notifications/bulk', icon: 'megaphone-outline', label: 'Toplu duyuru' },
      { href: '/admin/emergency-locations', icon: 'warning-outline', label: 'Acil lokasyonlari yonet' },
      { href: '/admin/reports', icon: 'flag-outline', label: 'Şikayetler (paylaşım bildirimleri)', badge: 0 },
      { href: '/admin/complaints', icon: 'chatbox-ellipses-outline', label: 'Misafir Şikayet/Oneri', badge: 0 },
      { href: '/admin/staff-complaints', icon: 'alert-circle-outline', label: 'Personel Şikayet Notları' },
    ],
  },
  {
    title: 'Stok & Onaylar',
    subtitle: 'Envanter ve onay bekleyenler',
    icon: 'albums-outline',
    items: [
      { href: '/admin/stock', icon: 'cube-outline', label: 'Stok yönetimi' },
      { href: '/admin/stock/all', icon: 'layers-outline', label: 'Tüm stoklar' },
      { href: '/admin/stock/approvals', icon: 'checkmark-done-outline', label: 'Onay bekleyenler', badge: 0 },
      { href: '/admin/expenses', icon: 'wallet-outline', label: 'Personel harcamaları', badge: 0 },
      { href: '/admin/carbon', icon: 'leaf-outline', label: 'Karbon girdileri' },
      { href: '/admin/breakfast-confirm', icon: 'cafe-outline', label: 'Kahvaltı Teyit Kayıtları' },
      { href: '/admin/transfer-tour', icon: 'car-sport-outline', label: 'Transfer & Tur' },
      { href: '/admin/dining-venues', icon: 'restaurant-outline', label: 'Yemek & Mekanlar' },
      { href: '/admin/salary', icon: 'cash-outline', label: 'Maaş yönetimi' },
    ],
  },
  {
    title: 'Erişim & Güvenlik',
    icon: 'shield-checkmark-outline',
    items: [
      { href: '/admin/access', icon: 'key-outline', label: 'Geçiş kontrolü' },
      { href: '/admin/cameras', icon: 'videocam-outline', label: 'Kamera yönetimi' },
      { href: '/admin/permissions', icon: 'shield-checkmark-outline', label: 'İzinler' },
      { href: '/admin/kbs-settings', icon: 'scan-outline', label: 'KBS Ayarları (Admin)' },
      { href: '/admin/kbs-permissions', icon: 'shield-outline', label: 'KBS Yetkileri (OPS)' },
    ],
  },
  {
    title: 'Kurumsal & Ayarlar',
    subtitle: 'Sözleşmeler ve personel',
    icon: 'settings-outline',
    items: [
      { href: '/admin/profile', icon: 'person-circle-outline', label: 'Profilim (hesap düzenle)' },
      { href: '/admin/app-links', icon: 'link-outline', label: 'Uygulamalar & Web Siteleri' },
      { href: '/admin/settings/printer', icon: 'print-outline', label: 'Yazici ayarlari' },
      { href: '/admin/documents', icon: 'folder-open-outline', label: 'Doküman Yönetimi' },
      { href: '/admin/maliye', icon: 'shield-outline', label: 'Maliye Evrak Merkezi' },
      { href: '/admin/incident-reports', icon: 'document-text-outline', label: 'Tutanaklar' },
      { href: '/admin/missing-items', icon: 'alert-circle-outline', label: 'Eksik Var' },
      { href: '/admin/contracts', icon: 'document-outline', label: 'Sözleşmeler' },
      { href: '/admin/contracts/contact-directory', icon: 'call-outline', label: 'İletişim rehberi' },
      { href: '/admin/contracts/all', icon: 'document-text-outline', label: 'Tüm Sözleşmelerim' },
      { href: '/admin/staff', icon: 'person-add-outline', label: 'Çalışan ekleme', badge: 0 },
      { href: '/admin/staff/list', icon: 'people-outline', label: 'Kullanıcılar listesi' },
      { href: '/admin/qr-designs', icon: 'qr-code-outline', label: 'QR tasarımları' },
    ],
  },
];

function adminSectionsForUi() {
  if (isKbsUiEnabled()) return SECTIONS;
  return SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((i) => !i.href.includes('/admin/kbs')),
  }));
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function AdminMenuButton({
  item,
  badge,
  isLast,
  onPress,
  tint,
  delay = 0,
}: {
  item: SectionItem;
  badge?: number;
  isLast: boolean;
  onPress: () => void;
  tint: { bg: string; icon: string };
  delay?: number;
}) {
  const showBadge = badge != null && badge > 0;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterTranslateY = useRef(new Animated.Value(8)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 260,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(enterTranslateY, {
        toValue: 0,
        duration: 260,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, enterOpacity, enterTranslateY]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.985,
      damping: 16,
      stiffness: 220,
      mass: 0.35,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      damping: 16,
      stiffness: 240,
      mass: 0.35,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedTouchableOpacity
      style={[
        styles.menuRow,
        !isLast && styles.menuRowSpacing,
        {
          opacity: enterOpacity,
          transform: [{ translateY: enterTranslateY }, { scale: pressScale }],
        },
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: tint.bg }]}>
        <Ionicons name={item.icon} size={22} color={tint.icon} />
      </View>
      <Text style={styles.menuLabel} numberOfLines={2}>
        {item.label}
      </Text>
      <View style={styles.menuRowRight}>
        {showBadge ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={tint.icon} />
      </View>
    </AnimatedTouchableOpacity>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { staff } = useAuthStore();
  const adminSections = useMemo(() => adminSectionsForUi(), []);
  const [stats, setStats] = useState<Stats>({
    roomsTotal: 0,
    roomsOccupied: 0,
    guestsActive: 0,
    staffActive: 0,
    stockPending: 0,
    staffPending: 0,
    expensesPending: 0,
    unreadNotifs: 0,
    messagesUnread: 0,
    feedTotal: 0,
    reportsPending: 0,
    complaintsPending: 0,
    acceptancesUnassigned: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!staff?.id) return;
    const [
      roomsRes,
      roomsOccupiedRes,
      guestsRes,
      staffRes,
      stockRes,
      staffPendingRes,
      expensesPendingRes,
      unreadRes,
      feedCountRes,
      reportsPendingRes,
      complaintsPendingRes,
      acceptancesUnassignedRes,
      conversationsList,
    ] = await Promise.all([
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'occupied'),
      supabase.from('guests').select('id', { count: 'exact', head: true }).eq('status', 'checked_in'),
      supabase.from('staff').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_online', true),
      supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('staff_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('staff_expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('staff_id', staff.id).is('read_at', null),
      supabase.from('feed_posts').select('*', { count: 'exact', head: true }),
      supabase.from('feed_post_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('guest_complaints').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('contract_acceptances').select('id', { count: 'exact', head: true }).is('assigned_staff_id', null),
      staffListConversations(staff.id),
    ]);

    const messagesUnread = (conversationsList ?? []).reduce((s, c) => s + (c.unread_count ?? 0), 0);
    setStats({
      roomsTotal: roomsRes.count ?? 0,
      roomsOccupied: roomsOccupiedRes.count ?? 0,
      guestsActive: guestsRes.count ?? 0,
      staffActive: staffRes.count ?? 0,
      stockPending: stockRes.count ?? 0,
      staffPending: staffPendingRes.count ?? 0,
      expensesPending: expensesPendingRes.count ?? 0,
      unreadNotifs: unreadRes.count ?? 0,
      messagesUnread,
      feedTotal: feedCountRes.count ?? 0,
      reportsPending: reportsPendingRes.count ?? 0,
      complaintsPending: complaintsPendingRes.count ?? 0,
      acceptancesUnassigned: acceptancesUnassignedRes.count ?? 0,
    });
  }, [staff?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const contentWidth = width - H_PAD * 2;

  const { getEffectiveBadge, setDismissed } = useAdminBadgeDismissedStore();

  const getBadgeKey = (href: string): keyof typeof stats | null => {
    if (href === '/admin/stock/approvals') return 'stockPending';
    if (href === '/admin/staff') return 'staffPending';
    if (href === '/admin/expenses') return 'expensesPending';
    if (href === '/admin/reports') return 'reportsPending';
    if (href === '/admin/complaints') return 'complaintsPending';
    if (href === '/admin/contracts') return 'acceptancesUnassigned';
    return null;
  };

  const totalApprovals = useMemo(
    () =>
      stats.staffPending +
      stats.stockPending +
      stats.expensesPending +
      stats.reportsPending +
      stats.complaintsPending +
      stats.acceptancesUnassigned,
    [stats]
  );

  const approvalsHubBadge = getEffectiveBadge('approvalsTotal', totalApprovals);

  const lastKnownApprovalsTotalRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = lastKnownApprovalsTotalRef.current;
    if (prev !== null && totalApprovals > prev) {
      Alert.alert(
        'Yeni onay bekleyen işlem',
        `Bekleyen toplam kayıt: ${totalApprovals} (önceki: ${prev}). Birleşik listeden inceleyebilirsiniz.`,
        [
          { text: 'Tamam', style: 'cancel' },
          { text: 'Onaya sunulan', onPress: () => router.push('/admin/approvals' as never) },
        ]
      );
    }
    lastKnownApprovalsTotalRef.current = totalApprovals;
  }, [router, totalApprovals]);

  const getBadge = (item: SectionItem): number | undefined => {
    const key = getBadgeKey(item.href);
    if (!key) return undefined;
    const raw = stats[key];
    if (raw == null) return undefined;
    const effective = getEffectiveBadge(key as any, raw);
    return effective > 0 ? effective : undefined;
  };

  const getSectionBadge = (items: SectionItem[]): number | undefined => {
    const total = items.reduce((sum, item) => sum + (getBadge(item) ?? item.badge ?? 0), 0);
    return total > 0 ? total : undefined;
  };

  const handleTilePress = (item: SectionItem) => {
    const key = getBadgeKey(item.href);
    if (key) {
      const raw = stats[key];
      if (raw != null && raw > 0) setDismissed(key as any, raw);
    }
    router.push(item.href as any);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminTheme.colors.accent} />
      }
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.approvalsHubCard, { width: contentWidth }]}
        activeOpacity={0.88}
        onPress={() => {
          setDismissed('approvalsTotal', totalApprovals);
          router.push('/admin/approvals' as never);
        }}
      >
        <View style={styles.approvalsHubIconWrap}>
          <Ionicons name="shield-checkmark-outline" size={26} color="#0f766e" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.approvalsHubKicker}>Yonetim</Text>
          <Text style={styles.approvalsHubTitle}>Onaya sunulan</Text>
          <Text style={styles.approvalsHubSub} numberOfLines={2}>
            Personel başvurusu, stok, harcama, paylaşım bildirimi ve sözleşme ataması — tek listede inceleyin ve onaylayın.
          </Text>
          <Text style={styles.approvalsHubMeta}>
            Bekleyen toplam: {totalApprovals}
            {totalApprovals > 0 ? ' · Detay için dokunun' : ''}
          </Text>
        </View>
        {approvalsHubBadge > 0 ? (
          <View style={styles.approvalsHubBadge}>
            <Text style={styles.approvalsHubBadgeText}>{approvalsHubBadge > 99 ? '99+' : approvalsHubBadge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={22} color={adminTheme.colors.textMuted} />
      </TouchableOpacity>

      {adminSections.map((section, sectionIdx) => (
        <View key={sectionIdx} style={styles.section}>
          <AdminCard padded={false} elevated>
            <View style={styles.sectionHeadPadded}>
              {(() => {
                const sectionBadge = getSectionBadge(section.items);
                const tint = SECTION_TINTS[section.title] ?? {
                  bg: adminTheme.colors.surfaceSecondary,
                  icon: adminTheme.colors.textMuted,
                };
                return (
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleLeft}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: tint.bg }]}>
                    <Ionicons name={section.icon} size={16} color={tint.icon} />
                  </View>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                {sectionBadge ? (
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>
                      {sectionBadge > 99 ? '99+' : sectionBadge}
                    </Text>
                  </View>
                ) : null}
              </View>
                );
              })()}
              {section.subtitle ? <Text style={styles.sectionSubtitle}>{section.subtitle}</Text> : null}
            </View>
            <View style={styles.menuList}>
              {section.items.map((item, idx) => {
                const badge = getBadge(item) ?? item.badge;
                const isLast = idx === section.items.length - 1;
                const tint = SECTION_TINTS[section.title] ?? {
                  bg: adminTheme.colors.surfaceSecondary,
                  icon: adminTheme.colors.textMuted,
                };
                return (
                  <AdminMenuButton
                    key={idx}
                    item={item}
                    badge={badge}
                    isLast={isLast}
                    onPress={() => handleTilePress(item)}
                    tint={tint}
                    delay={Math.min(220, sectionIdx * 40 + idx * 22)}
                  />
                );
              })}
            </View>
          </AdminCard>
        </View>
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
    paddingHorizontal: H_PAD,
    paddingTop: 16,
  },
  approvalsHubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fffd',
    borderRadius: adminTheme.radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bae6dd',
    ...((Platform.OS === 'ios' ? adminTheme.shadow.md : { elevation: 4 }) as ViewStyle),
  },
  approvalsHubIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalsHubKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#0f766e',
    textTransform: 'uppercase',
  },
  approvalsHubTitle: { fontSize: 16, fontWeight: '900', color: adminTheme.colors.text },
  approvalsHubSub: { fontSize: 12, fontWeight: '600', color: adminTheme.colors.textSecondary, marginTop: 4, lineHeight: 17 },
  approvalsHubMeta: { fontSize: 12, fontWeight: '700', color: '#0f766e', marginTop: 8 },
  approvalsHubBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 7,
    backgroundColor: adminTheme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalsHubBadgeText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  section: {
    marginBottom: 16,
  },
  sectionHeadPadded: {
    paddingHorizontal: adminTheme.spacing.lg,
    paddingTop: adminTheme.spacing.lg,
    paddingBottom: adminTheme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: adminTheme.colors.text,
    letterSpacing: -0.2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: adminTheme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: adminTheme.colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  menuList: {
    paddingBottom: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: adminTheme.spacing.lg,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: adminTheme.colors.borderLight,
  },
  menuRowSpacing: {
    marginBottom: 8,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: adminTheme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: adminTheme.colors.text,
    lineHeight: 21,
    paddingRight: 8,
  },
  menuRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: adminTheme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    marginRight: 6,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
});
