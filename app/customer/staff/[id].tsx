import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getOrCreateGuestForCaller } from '@/lib/getOrCreateGuestForCaller';
import { guestGetOrCreateConversationWithStaff } from '@/lib/messagingApi';
import { useGuestMessagingStore } from '@/stores/guestMessagingStore';
import { useAuthStore } from '@/stores/authStore';
import { theme } from '@/constants/theme';
import { AvatarWithBadge } from '@/components/VerifiedBadge';
import { CachedImage } from '@/components/CachedImage';

const COVER_HEIGHT = 240;
const AVATAR_SIZE = 112;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type StaffDetail = {
  id: string;
  full_name: string | null;
  department: string | null;
  position: string | null;
  profile_image: string | null;
  cover_image: string | null;
  bio: string | null;
  is_online: boolean | null;
  hire_date: string | null;
  average_rating: number | null;
  total_reviews: number | null;
  specialties: string[] | null;
  languages: string[] | null;
  office_location: string | null;
  achievements: string[] | null;
  show_phone_to_guest: boolean | null;
  show_email_to_guest: boolean | null;
  show_whatsapp_to_guest: boolean | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  shift?: { start_time: string; end_time: string } | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  guest?: { full_name: string | null; room_number?: string | null } | null;
};

const CUSTOMER_REVIEW_LIMIT = 5;

export default function StaffProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { appToken, setAppToken } = useGuestMessagingStore();
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [coverModalVisible, setCoverModalVisible] = useState(false);
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [rateStars, setRateStars] = useState(0);
  const [rateComment, setRateComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadStaff = useCallback(async () => {
    if (!id) return;
      // RPC kullan: profil ziyaretlerinde telefon/e-posta kesin gelsin (migration 042)
      const { data: rows, error: e } = await supabase.rpc('get_staff_public_profile', {
        p_staff_id: id,
      });
      const s = Array.isArray(rows) ? rows[0] : rows;
      if (e || !s) {
        setStaff(null);
        setLoading(false);
        return;
      }
      const raw = s as StaffDetail & {
        profile_contact?: {
          phone?: string | null;
          email?: string | null;
          whatsapp?: string | null;
          show_phone_to_guest?: boolean | null;
          show_email_to_guest?: boolean | null;
          show_whatsapp_to_guest?: boolean | null;
        };
      };
      const c = raw.profile_contact;
      const staffData: StaffDetail = {
        ...raw,
        shift: undefined,
        phone: c?.phone ?? raw.phone,
        email: c?.email ?? raw.email,
        whatsapp: c?.whatsapp ?? raw.whatsapp,
        show_phone_to_guest: c?.show_phone_to_guest ?? raw.show_phone_to_guest,
        show_email_to_guest: c?.show_email_to_guest ?? raw.show_email_to_guest,
        show_whatsapp_to_guest: c?.show_whatsapp_to_guest ?? raw.show_whatsapp_to_guest,
      };
      setStaff(staffData);
      if (s.shift_id) {
        const { data: shift } = await supabase
          .from('shifts')
          .select('start_time, end_time')
          .eq('id', s.shift_id)
          .single();
        setStaff((prev) => (prev ? { ...prev, shift: shift ?? null } : null));
      }
      const { data: r } = await supabase
        .from('staff_reviews')
        .select('id, rating, comment, created_at, guest_id')
        .eq('staff_id', id)
        .order('created_at', { ascending: false })
        .limit(CUSTOMER_REVIEW_LIMIT);
      const reviewRows = (r ?? []) as (Review & { guest_id?: string })[];
      if (reviewRows.some((x) => x.guest_id)) {
        const guestIds = [...new Set(reviewRows.map((x) => x.guest_id).filter(Boolean))] as string[];
        const { data: guests } = await supabase
          .from('guests')
          .select('id, full_name, room_id')
          .in('id', guestIds);
        const guestList = (guests ?? []) as { id: string; full_name: string | null; room_id: string | null }[];
        const roomIds = [...new Set(guestList.map((g) => g.room_id).filter(Boolean))] as string[];
        let roomMap = new Map<string, string>();
        if (roomIds.length > 0) {
          const { data: rooms } = await supabase
            .from('rooms')
            .select('id, room_number')
            .in('id', roomIds);
          roomMap = new Map((rooms ?? []).map((ro: { id: string; room_number: string }) => [ro.id, ro.room_number]));
        }
        const guestMap = new Map(
          guestList.map((g) => [
            g.id,
            {
              full_name: g.full_name,
              room_number: g.room_id ? roomMap.get(g.room_id) ?? null : null,
            },
          ])
        );
        setReviews(
          reviewRows.map((x) => ({
            id: x.id,
            rating: x.rating,
            comment: x.comment,
            created_at: x.created_at,
            guest: x.guest_id ? guestMap.get(x.guest_id) ?? null : null,
          }))
        );
      } else {
        setReviews(reviewRows.map(({ guest_id: _, ...rest }) => rest));
      }
      setLoading(false);
  }, [id]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const onMessage = async () => {
    if (!id) return;
    let token = appToken;
    if (!token) {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      const row = await getOrCreateGuestForCaller(session?.user);
      if (row?.app_token) {
        await setAppToken(row.app_token);
        token = row.app_token;
      }
    }
    if (!token) {
      router.push({ pathname: '/customer/new-chat', params: { staffId: id } });
      return;
    }
    setStartingChat(true);
    try {
      const convId = await guestGetOrCreateConversationWithStaff(token, id);
      if (convId) router.push({ pathname: '/customer/chat/[id]', params: { id: convId } });
      else router.push({ pathname: '/customer/new-chat', params: { staffId: id } });
    } catch {
      router.push({ pathname: '/customer/new-chat', params: { staffId: id } });
    }
    setStartingChat(false);
  };

  const openRateModal = () => {
    setRateStars(0);
    setRateComment('');
    setRateModalVisible(true);
  };

  const submitReview = async () => {
    if (!id || rateStars < 1 || rateStars > 5) return;
    setSubmittingReview(true);
    try {
      let guestId: string | null = null;
      const email = (user?.email ?? user?.user_metadata?.email ?? '').toString().trim();
      if (email) {
        const { data: guest } = await supabase
          .from('guests')
          .select('id')
          .eq('email', email)
          .limit(1)
          .maybeSingle();
        if (guest?.id) guestId = guest.id;
      }
      const { error } = await supabase.from('staff_reviews').insert({
        staff_id: id,
        guest_id: guestId,
        rating: rateStars,
        comment: rateComment.trim() || null,
      });
      if (error) throw error;
      setRateModalVisible(false);
      await loadStaff();
    } catch {
      setSubmittingReview(false);
      return;
    }
    setSubmittingReview(false);
  };

  const onCall = () => {
    const phone = staff?.phone?.trim();
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }
  if (!staff) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Personel bulunamadı</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasPhone = !!staff.phone?.trim();
  const hasEmail = !!staff.email?.trim();
  const hasWhatsApp = !!staff.whatsapp?.trim();
  const showPhone = (staff.show_phone_to_guest !== false) && hasPhone;
  const showEmail = (staff.show_email_to_guest !== false) && hasEmail;
  const showWhatsApp = (staff.show_whatsapp_to_guest !== false) && hasWhatsApp;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.coverBlock}>
        <TouchableOpacity
          style={styles.coverImageClip}
          activeOpacity={1}
          onPress={() => staff.cover_image && setCoverModalVisible(true)}
        >
          {staff.cover_image ? (
            <CachedImage uri={staff.cover_image} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
        </TouchableOpacity>
        <View style={styles.avatarOnCover}>
          <AvatarWithBadge badge={staff.verification_badge ?? null} avatarSize={120} badgeSize={20}>
            <CachedImage uri={staff.profile_image || 'https://via.placeholder.com/120'} style={styles.avatar} contentFit="cover" />
          </AvatarWithBadge>
        </View>
      </View>
      <View style={[styles.avatarHeaderWrap, { paddingTop: AVATAR_SIZE / 2 + 8 }]}>
        <View style={styles.header}>
          <Text style={styles.name}>{staff.full_name || 'Personel'}</Text>
          <Text style={styles.dept}>{staff.position || staff.department || '—'}</Text>
          <View style={styles.onlineRow}>
            <View style={[styles.dot, staff.is_online ? styles.dotOn : styles.dotOff]} />
            <Text style={styles.onlineText}>{staff.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.section}
        onPress={() => setReviewsModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.sectionTitle}>⭐ Puan</Text>
        <Text style={styles.rating}>
          {staff.average_rating != null && staff.average_rating > 0
            ? `${Number(staff.average_rating).toFixed(1)} (${staff.total_reviews ?? 0} değerlendirme)`
            : `Henüz puan yok (${staff.total_reviews ?? 0} değerlendirme)`}
        </Text>
        <Text style={styles.reviewsTapHint}>Değerlendirmeleri görüntüle</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Temel bilgiler</Text>
        <View style={styles.card}>
          {staff.hire_date && (
            <Row
              label="İşe başlama"
              value={new Date(staff.hire_date).toLocaleDateString('tr-TR')}
            />
          )}
          {staff.shift && (
            <Row
              label="Çalışma saatleri"
              value={`${staff.shift.start_time} - ${staff.shift.end_time}`}
            />
          )}
          {staff.office_location && (
            <Row label="Konum" value={staff.office_location} />
          )}
          {staff.is_online != null && (
            <Row
              label="Durum"
              value={staff.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}
            />
          )}
        </View>
      </View>

      {staff.specialties?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Uzmanlıklar</Text>
          <View style={styles.card}>
            {staff.specialties.map((s, i) => (
              <Text key={i} style={styles.bullet}>• {s}</Text>
            ))}
          </View>
        </View>
      ) : null}

      {staff.languages?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗣️ Konuşulan diller</Text>
          <View style={styles.card}>
            {staff.languages.map((l, i) => (
              <Text key={i} style={styles.bullet}>• {l}</Text>
            ))}
          </View>
        </View>
      ) : null}

      {staff.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Hakkımda</Text>
          <View style={styles.card}>
            <Text style={styles.bio}>{staff.bio}</Text>
          </View>
        </View>
      ) : null}

      {staff.achievements?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Başarılar</Text>
          <View style={styles.card}>
            {staff.achievements.map((a, i) => (
              <Text key={i} style={styles.bullet}>• {a}</Text>
            ))}
          </View>
        </View>
      ) : null}

      {reviews.length > 0 && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => setReviewsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionTitle}>💬 Son değerlendirmeler</Text>
          <View style={styles.card}>
            {reviews.slice(0, 2).map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <Text style={styles.reviewMeta}>
                  {r.guest?.full_name || 'Misafir'}
                  {r.guest?.room_number ? ` (Oda ${r.guest.room_number})` : ''} · {formatReviewDate(r.created_at)}
                </Text>
                <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}</Text>
                {r.comment ? (
                  <Text style={styles.reviewComment} numberOfLines={1}>"{r.comment}"</Text>
                ) : null}
              </View>
            ))}
            {reviews.length > 2 && (
              <Text style={styles.reviewsMore}>+{reviews.length - 2} değerlendirme daha — tıklayın</Text>
            )}
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.avatarActionsRow}>
        {showPhone && (
          <TouchableOpacity
            onPress={onCall}
            style={[styles.avatarActionCircle, styles.avatarActionPhone]}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        )}
        {showWhatsApp && (
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(`https://wa.me/${staff.whatsapp!.trim().replace(/\D/g, '')}`)
            }
            style={[styles.avatarActionCircle, styles.avatarActionWhatsApp]}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        )}
        {showEmail && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${staff.email!.trim()}`)}
            style={[styles.avatarActionCircle, styles.avatarActionMail]}
            activeOpacity={0.8}
          >
            <Ionicons name="mail" size={20} color={theme.colors.white} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onMessage}
          style={[styles.avatarActionCircle, styles.avatarActionMessage]}
          disabled={startingChat}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={20} color={theme.colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openRateModal}
          style={[styles.avatarActionCircle, styles.avatarActionStar]}
          activeOpacity={0.8}
        >
          <Ionicons name="star-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.bottomPad} />

      <Modal
        visible={coverModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCoverModalVisible(false)}
      >
        <Pressable style={styles.imageModalOverlay} onPress={() => setCoverModalVisible(false)}>
          <Pressable style={styles.imageModalContent} onPress={() => {}}>
            {staff.cover_image ? (
              <CachedImage uri={staff.cover_image} style={styles.imageModalImage} contentFit="contain" />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={reviewsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewsModalVisible(false)}
      >
        <Pressable
          style={styles.rateModalOverlay}
          onPress={() => setReviewsModalVisible(false)}
        >
          <Pressable style={styles.reviewsModalBox} onPress={() => {}}>
            <Text style={styles.reviewsModalTitle}>💬 Değerlendirmeler</Text>
            <Text style={styles.reviewsModalSubtitle}>
              {staff?.full_name || 'Personel'} — {reviews.length} değerlendirme
            </Text>
            <ScrollView style={styles.reviewsModalList} showsVerticalScrollIndicator={false}>
              {reviews.length === 0 ? (
                <Text style={styles.reviewsModalEmpty}>Henüz değerlendirme yok.</Text>
              ) : (
                reviews.map((r) => (
                  <View key={r.id} style={styles.reviewsModalItem}>
                    <View style={styles.reviewsModalItemHeader}>
                      <Text style={styles.reviewsModalItemStars}>
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </Text>
                      <Text style={styles.reviewsModalItemDate}>{formatReviewDate(r.created_at)}</Text>
                    </View>
                    <Text style={styles.reviewsModalItemMeta}>
                      {r.guest?.full_name || 'Misafir'}
                      {r.guest?.room_number ? ` · Oda ${r.guest.room_number}` : ''}
                    </Text>
                    {r.comment ? (
                      <Text style={styles.reviewsModalItemComment}>"{r.comment}"</Text>
                    ) : (
                      <Text style={styles.reviewsModalItemNoComment}>Yorum yok</Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.reviewsModalActions}>
              <TouchableOpacity
                style={styles.reviewsModalCloseBtn}
                onPress={() => setReviewsModalVisible(false)}
              >
                <Text style={styles.reviewsModalCloseText}>Kapat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reviewsModalCloseBtn, styles.reviewsModalRateBtn]}
                onPress={() => {
                  setReviewsModalVisible(false);
                  openRateModal();
                }}
              >
                <Ionicons name="star-outline" size={18} color={theme.colors.white} />
                <Text style={styles.reviewsModalRateText}>Puan ver</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={rateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !submittingReview && setRateModalVisible(false)}
      >
        <Pressable
          style={styles.rateModalOverlay}
          onPress={() => !submittingReview && setRateModalVisible(false)}
        >
          <Pressable style={styles.rateModalBox} onPress={() => {}}>
            <Text style={styles.rateModalTitle}>Puan ver</Text>
            <Text style={styles.rateModalSubtitle}>{staff?.full_name || 'Personel'} hakkında değerlendirmeniz</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRateStars(n)}
                  style={styles.starBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={rateStars >= n ? 'star' : 'star-outline'}
                    size={36}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.rateCommentInput}
              placeholder="Yorum (isteğe bağlı)"
              placeholderTextColor={theme.colors.textMuted}
              value={rateComment}
              onChangeText={setRateComment}
              multiline
              numberOfLines={3}
              editable={!submittingReview}
            />
            <View style={styles.rateModalActions}>
              <TouchableOpacity
                style={[styles.rateModalBtn, styles.rateModalBtnCancel]}
                onPress={() => !submittingReview && setRateModalVisible(false)}
                disabled={submittingReview}
              >
                <Text style={styles.rateModalBtnCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rateModalBtn, styles.rateModalBtnSubmit]}
                onPress={submitReview}
                disabled={submittingReview || rateStars < 1}
                activeOpacity={0.8}
              >
                {submittingReview ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.rateModalBtnSubmitText}>Gönder</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatReviewDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Dün';
  if (diff < 7) return `${diff} gün önce`;
  if (diff < 30) return `${Math.floor(diff / 7)} hafta önce`;
  return d.toLocaleDateString('tr-TR');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 8, fontSize: 15, color: theme.colors.textMuted },
  errorText: { fontSize: 16, color: theme.colors.text },
  backBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: theme.colors.primary, borderRadius: 12 },
  backBtnText: { color: theme.colors.white, fontWeight: '600' },
  headerBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backButton: { padding: 8 },
  coverBlock: {
    width: SCREEN_WIDTH,
    height: COVER_HEIGHT,
    position: 'relative',
    overflow: 'visible',
    backgroundColor: theme.colors.borderLight,
  },
  coverImageClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: COVER_HEIGHT,
    overflow: 'hidden',
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.borderLight,
  },
  avatarOnCover: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -AVATAR_SIZE / 2 + 55,
    alignItems: 'center',
  },
  avatarHeaderWrap: { alignItems: 'center', paddingBottom: 4 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: theme.colors.surface,
    backgroundColor: theme.colors.borderLight,
    shadowOpacity: 0.2,
    elevation: 6,
  },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 6 },
  name: { ...theme.typography.title, color: theme.colors.text },
  dept: { fontSize: 16, color: theme.colors.primary, marginTop: 4 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  dotOn: { backgroundColor: theme.colors.success },
  dotOff: { backgroundColor: theme.colors.textMuted },
  onlineText: { fontSize: 13, color: theme.colors.textMuted },
  section: { paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 14, color: theme.colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '500', color: theme.colors.text },
  bullet: { fontSize: 14, color: theme.colors.text, marginBottom: 4 },
  bio: { fontSize: 14, color: theme.colors.text, lineHeight: 22 },
  rating: { fontSize: 14, color: theme.colors.primary, fontWeight: '600' },
  reviewCard: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  reviewMeta: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 4 },
  reviewStars: { color: theme.colors.primary, marginBottom: 4 },
  reviewComment: { fontSize: 13, color: theme.colors.text, fontStyle: 'italic' },
  reviewsTapHint: { fontSize: 12, color: theme.colors.primary, marginTop: 4 },
  reviewsMore: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8, textAlign: 'center' },
  avatarActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    marginTop: 8,
  },
  avatarActionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActionPhone: { backgroundColor: theme.colors.primary },
  avatarActionWhatsApp: { backgroundColor: '#25D366' },
  avatarActionMail: { backgroundColor: theme.colors.accent },
  avatarActionMessage: { backgroundColor: theme.colors.primary },
  avatarActionStar: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.primary },
  bottomPad: { height: 32 },
  reviewsModalBox: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  reviewsModalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  reviewsModalSubtitle: { fontSize: 13, color: theme.colors.textMuted, marginBottom: theme.spacing.md },
  reviewsModalList: { maxHeight: 320, marginBottom: theme.spacing.md },
  reviewsModalEmpty: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  reviewsModalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  reviewsModalItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewsModalItemStars: { fontSize: 16, color: theme.colors.primary },
  reviewsModalItemDate: { fontSize: 12, color: theme.colors.textMuted },
  reviewsModalItemMeta: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 4 },
  reviewsModalItemComment: { fontSize: 14, color: theme.colors.text, fontStyle: 'italic' },
  reviewsModalItemNoComment: { fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic' },
  reviewsModalActions: { flexDirection: 'row', gap: 12 },
  reviewsModalCloseBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.radius.md, alignItems: 'center', backgroundColor: theme.colors.borderLight },
  reviewsModalCloseText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  reviewsModalRateBtn: { backgroundColor: theme.colors.primary },
  reviewsModalRateText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: { maxWidth: '100%', maxHeight: '90%', justifyContent: 'center', alignItems: 'center' },
  imageModalImage: { width: SCREEN_WIDTH, height: 280, maxWidth: '100%' },
  rateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  rateModalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  rateModalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  rateModalSubtitle: { fontSize: 14, color: theme.colors.textMuted, marginBottom: theme.spacing.lg },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: theme.spacing.lg },
  starBtn: { padding: 4 },
  rateCommentInput: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.lg,
  },
  rateModalActions: { flexDirection: 'row', gap: 12 },
  rateModalBtn: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  rateModalBtnCancel: { backgroundColor: theme.colors.borderLight },
  rateModalBtnCancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  rateModalBtnSubmit: { backgroundColor: theme.colors.primary },
  rateModalBtnSubmitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});
