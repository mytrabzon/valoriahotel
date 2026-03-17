import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  useWindowDimensions,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Video, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useScrollToTopStore } from '@/stores/scrollToTopStore';
import { theme } from '@/constants/theme';
import { StaffNameWithBadge, AvatarWithBadge } from '@/components/VerifiedBadge';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { getOrCreateGuestForCurrentSession } from '@/lib/getOrCreateGuestForCaller';
import { notifyAdmins } from '@/lib/notificationService';
import { CachedImage } from '@/components/CachedImage';

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam / tekrarlayan içerik' },
  { value: 'inappropriate', label: 'Uygunsuz içerik' },
  { value: 'violence', label: 'Şiddet veya tehdit' },
  { value: 'hate', label: 'Nefret söylemi veya ayrımcılık' },
  { value: 'false_info', label: 'Yanıltıcı bilgi' },
  { value: 'other', label: 'Diğer' },
];

type StaffRow = {
  id: string;
  full_name: string | null;
  department: string | null;
  profile_image: string | null;
  is_online: boolean | null;
  last_active: string | null;
  work_status: string | null;
  verification_badge?: 'blue' | 'yellow' | null;
};

type HotelInfoRow = {
  id: string;
  name: string | null;
  description: string | null;
  address: string | null;
  stars: number | null;
};

type FeedPost = {
  id: string;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  created_at: string;
  staff: { full_name: string | null; department: string | null; profile_image?: string | null; verification_badge?: 'blue' | 'yellow' | null } | null;
  guest: { full_name: string | null } | null;
};

type MyRoom = {
  room_number: string;
  view_type: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const WORK_STATUS_COLOR: Record<string, string> = {
  active: theme.colors.success,
  break: '#eab308',
  off: theme.colors.error,
  leave: '#9ca3af',
};

function getDisplayName(): string {
  const { user } = useAuthStore.getState();
  if (!user) return '';
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (name && typeof name === 'string') return name.trim();
  const email = user.email ?? '';
  const part = email.split('@')[0];
  if (part) return part.charAt(0).toUpperCase() + part.slice(1);
  return 'Misafir';
}

export default function CustomerHome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeStaff, setActiveStaff] = useState<StaffRow[]>([]);
  const [hotelInfo, setHotelInfo] = useState<HotelInfoRow | null>(null);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [myRoom, setMyRoom] = useState<MyRoom | null>(null);
  const [facilities, setFacilities] = useState<{ name: string; icon: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fullscreenPostMedia, setFullscreenPostMedia] = useState<{
    uri: string;
    mediaType: 'image' | 'video';
    posterUri?: string;
  } | null>(null);
  const [fullscreenVideoReady, setFullscreenVideoReady] = useState(false);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [reportPost, setReportPost] = useState<FeedPost | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const fullscreenVideoRef = useRef<Video>(null);
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const setScrollToTop = useScrollToTopStore((s) => s.setScrollToTop);
  const onlineBlinkOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(onlineBlinkOpacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(onlineBlinkOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [onlineBlinkOpacity]);

  useEffect(() => {
    setScrollToTop(() => () => scrollRef.current?.scrollTo({ y: 0, animated: true }));
    return () => setScrollToTop(null);
  }, [setScrollToTop]);

  // Video sesi hoparlörden tam açılsın (Android ses kısık sorunu)
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  // Tam ekran video açıldığında poster overlay sıfırla (yeni video = henüz yüklenmedi)
  useEffect(() => {
    if (fullscreenPostMedia?.mediaType === 'video') setFullscreenVideoReady(false);
  }, [fullscreenPostMedia?.uri, fullscreenPostMedia?.mediaType]);

  // Tam ekran video açıldığında oynat ve sesi aç
  useEffect(() => {
    if (!fullscreenPostMedia || fullscreenPostMedia.mediaType !== 'video') return;
    const t = setTimeout(() => {
      fullscreenVideoRef.current?.playAsync().catch(() => {});
      fullscreenVideoRef.current?.setVolumeAsync(1.0).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [fullscreenPostMedia?.uri, fullscreenPostMedia?.mediaType]);

  const load = useCallback(async () => {
    const [staffRes, hotelRes, feedRes, facilitiesRes] = await Promise.all([
      (async () => {
        const { data } = await supabase
          .from('staff')
          .select('id, full_name, department, profile_image, is_online, last_active, work_status, verification_badge, email')
          .eq('is_active', true)
          .order('is_online', { ascending: false })
          .order('last_active', { ascending: false });
        const rows = (data ?? []) as (StaffRow & { email?: string | null })[];
        const byKey = new Map<string, StaffRow>();
        rows.forEach((r) => {
          const key = (r.email && r.email.trim()) ? r.email.trim().toLowerCase() : r.id;
          if (!byKey.has(key)) byKey.set(key, { id: r.id, full_name: r.full_name, department: r.department, profile_image: r.profile_image, is_online: r.is_online, last_active: r.last_active, work_status: r.work_status, verification_badge: r.verification_badge });
        });
        return { data: Array.from(byKey.values()) };
      })(),
      supabase.from('hotel_info').select('id, name, description, address, stars').limit(1).maybeSingle(),
      supabase
        .from('feed_posts')
        .select('id, media_type, media_url, thumbnail_url, title, created_at, staff:staff_id(full_name, department, profile_image, verification_badge), guest:guest_id(full_name)')
        .eq('visibility', 'customers')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('facilities').select('name, icon').eq('is_active', true).order('sort_order').limit(6),
    ]);
    setActiveStaff(staffRes.data ?? []);
    setHotelInfo(hotelRes.data ?? null);
    setFeedPosts(feedRes.data ?? []);
    setFacilities(facilitiesRes.data ?? []);

    if (user?.email) {
      const { data: guest } = await supabase
        .from('guests')
        .select('room_id')
        .eq('email', user.email)
        .eq('status', 'checked_in')
        .order('check_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (guest?.room_id) {
        const { data: room } = await supabase
          .from('rooms')
          .select('room_number, view_type')
          .eq('id', guest.room_id)
          .single();
        const { data: g } = await supabase
          .from('guests')
          .select('check_in_at, check_out_at')
          .eq('room_id', guest.room_id)
          .eq('status', 'checked_in')
          .limit(1)
          .single();
        if (room && g)
          setMyRoom({
            room_number: room.room_number,
            view_type: room.view_type,
            check_in_at: g.check_in_at,
            check_out_at: g.check_out_at,
          });
        else setMyRoom(null);
      } else setMyRoom(null);
    }
  }, [user?.email]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    setLoading(false);
  }, [load]);

  useEffect(() => {
    load().then(() => setLoading(false));
  }, [load]);

  const openReportModal = (post: FeedPost) => {
    setMenuPostId(null);
    setReportPost(post);
    setReportReason('');
    setReportDetails('');
  };

  const submitReport = async () => {
    if (!reportPost || !reportReason.trim()) return;
    const guestRow = await getOrCreateGuestForCurrentSession();
    if (!guestRow?.app_token) {
      Alert.alert('Giriş gerekli', 'Bildirim göndermek için giriş yapın.');
      return;
    }
    const reasonLabel = REPORT_REASONS.find((r) => r.value === reportReason)?.label ?? reportReason;
    setSubmittingReport(true);
    try {
      const { data: reportId, error } = await supabase.rpc('report_feed_post_guest', {
        p_app_token: guestRow.app_token,
        p_post_id: reportPost.id,
        p_reason: reportReason.trim(),
        p_details: reportDetails.trim() || null,
      });
      if (error) {
        Alert.alert('Hata', error.message ?? 'Bildirim kaydedilemedi.');
        setSubmittingReport(false);
        return;
      }
      const postTitle = (reportPost.title ?? '').trim() || 'Paylaşım';
      await notifyAdmins({
        title: 'Paylaşım bildirimi (misafir)',
        body: `"${postTitle}" — ${reasonLabel}${reportDetails.trim() ? ` — ${reportDetails.trim().slice(0, 40)}…` : ''}`,
        data: { url: '/admin/reports', screen: 'admin', postId: reportPost.id },
      }).catch(() => {});
      setReportPost(null);
      setReportReason('');
      setReportDetails('');
      Alert.alert(
        'Bildiriminiz alındı',
        'Şikayetiniz yönetime iletildi. 24 saat içinde dönüş yapılacaktır.',
        [{ text: 'Tamam' }]
      );
    } catch (e) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Bildirim gönderilemedi.');
    }
    setSubmittingReport(false);
  };

  const displayName = getDisplayName();
  const locationName = hotelInfo?.name ?? 'Valoria Hotel';

  if (loading && activeStaff.length === 0 && !hotelInfo) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.welcomeBlock}>
          <Skeleton height={28} width={220} borderRadius={8} style={{ marginBottom: 6 }} />
          <Skeleton height={18} width={180} borderRadius={6} />
        </View>
        <Skeleton height={48} borderRadius={12} style={{ marginBottom: 24 }} />
        <View style={styles.categoryRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width={56} height={56} borderRadius={12} style={{ marginRight: 12 }} />
          ))}
        </View>
        <Text style={styles.sectionTitle}>Aktif çalışanlar</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={72} height={72} borderRadius={36} />
          ))}
        </View>
        <SkeletonCard />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      <View style={styles.welcomeBlock}>
        <Text style={styles.welcomeTitle}>
          {displayName ? `Hoş geldin, ${displayName}` : 'Hoş geldin'}
        </Text>
        <View style={styles.welcomeLocationRow}>
          <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.welcomeLocation}>{locationName}</Text>
        </View>
      </View>

      {/* Aktif çalışanlar - avatarlar aynı boyut, ortalanmış */}
      <Text style={styles.sectionLabel}>Aktif personel</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyRow}
        style={styles.storyScroll}
      >
        {activeStaff.map((staff) => {
          const statusColor = WORK_STATUS_COLOR[staff.work_status ?? 'active'] ?? theme.colors.success;
          return (
            <TouchableOpacity
              key={staff.id}
              style={styles.storyItem}
              onPress={() => router.push(`/customer/staff/${staff.id}`)}
              activeOpacity={0.8}
            >
              <View style={[styles.storyRing, { borderColor: statusColor }]}>
                <AvatarWithBadge badge={staff.verification_badge ?? null} avatarSize={72} badgeSize={14}>
                  <CachedImage
                    uri={staff.profile_image || 'https://via.placeholder.com/64'}
                    style={styles.storyAvatar}
                    contentFit="cover"
                  />
                </AvatarWithBadge>
                {staff.is_online ? (
                  <Animated.View style={[styles.statusDot, styles.statusDotOnline, { backgroundColor: theme.colors.success, opacity: onlineBlinkOpacity }]} />
                ) : (
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                )}
              </View>
              <View style={styles.storyTextBlock}>
                <StaffNameWithBadge
                  name={staff.full_name?.split(' ')[0] || 'Personel'}
                  badge={staff.verification_badge ?? null}
                  textStyle={styles.storyName}
                />
                <Text style={styles.storyDept} numberOfLines={1}>{staff.department || '—'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Paylaşımlar (feed) */}
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Paylaşımlar</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={() => router.push('/customer/feed/new')} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
          <Text style={styles.shareBtnText}>Paylaş</Text>
        </TouchableOpacity>
      </View>
      {feedPosts.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyFeedText}>Henüz paylaşım yok.</Text>
        </View>
      ) : (
        <View style={styles.feedList}>
          {feedPosts.slice(0, 5).map((post) => {
            const rawStaff = post.staff as { full_name?: string; department?: string; profile_image?: string | null; verification_badge?: 'blue' | 'yellow' | null } | null;
            const rawGuest = post.guest;
            const staffInfo = Array.isArray(rawStaff) ? rawStaff[0] ?? null : rawStaff;
            const guestInfo = Array.isArray(rawGuest) ? (rawGuest[0] as { full_name?: string | null } | null) ?? null : (rawGuest as { full_name?: string | null } | null);
            const authorName = (staffInfo?.full_name ?? guestInfo?.full_name ?? 'Misafir').trim() || 'Misafir';
            const dept = staffInfo?.department;
            const badge = staffInfo?.verification_badge ?? null;
            const profileImage = staffInfo?.profile_image;
            const isGuest = !staffInfo && (guestInfo || !rawStaff);
            const imageUri = post.media_type !== 'text' ? (post.thumbnail_url || post.media_url) : null;
            const hasMedia = !!imageUri;
            const avatarLetter = authorName.charAt(0).toUpperCase();
            return (
              <View key={post.id} style={styles.feedItem}>
                <View style={styles.feedItemHeader}>
                  {profileImage ? (
                    <CachedImage uri={profileImage} style={styles.feedAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.feedAvatar, styles.feedAvatarPlaceholder]}>
                      <Text style={styles.feedAvatarLetter}>{avatarLetter}</Text>
                    </View>
                  )}
                  <View style={styles.feedItemHeaderText}>
                    {staffInfo ? (
                      <StaffNameWithBadge name={authorName} badge={badge} textStyle={styles.feedAuthorName} />
                    ) : (
                      <Text style={styles.feedAuthorName} numberOfLines={1}>{authorName}</Text>
                    )}
                    {dept ? <Text style={styles.feedItemMeta}>{dept}</Text> : isGuest ? <Text style={styles.feedItemMeta}>Misafir</Text> : null}
                  </View>
                  {user ? (
                    <TouchableOpacity
                      style={styles.feedMenuBtn}
                      onPress={() => setMenuPostId(menuPostId === post.id ? null : post.id)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Modal
                  visible={menuPostId === post.id}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setMenuPostId(null)}
                >
                  <Pressable style={styles.menuModalOverlay} onPress={() => setMenuPostId(null)}>
                    <View style={styles.menuModalBox}>
                      <TouchableOpacity
                        style={styles.menuModalItem}
                        onPress={() => openReportModal(post)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="flag-outline" size={22} color={theme.colors.text} />
                        <Text style={styles.menuModalItemText}>Bildir</Text>
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                </Modal>
                {hasMedia ? (
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => {
                      const isVideo = post.media_type === 'video';
                      if (isVideo) {
                        setFullscreenPostMedia({
                          uri: post.media_url || post.thumbnail_url || '',
                          mediaType: 'video',
                          posterUri: post.thumbnail_url || post.media_url || undefined,
                        });
                      } else {
                        setFullscreenPostMedia({
                          uri: post.media_url || post.thumbnail_url || '',
                          mediaType: 'image',
                        });
                      }
                    }}
                    style={styles.postMediaTouchable}
                  >
                    <View style={styles.postImageWrap}>
                      {post.media_type === 'video' ? (
                        <Video
                          source={{ uri: post.media_url || post.thumbnail_url || '' }}
                          style={styles.postImage}
                          resizeMode="cover"
                          muted
                          shouldPlay={false}
                          useNativeControls={false}
                        />
                      ) : (
                        <CachedImage
                          uri={post.thumbnail_url || post.media_url || ''}
                          style={styles.postImage}
                          contentFit="cover"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.feedItemBody}>
                  {(post.title ?? '').trim() ? (
                    <Text style={[styles.feedItemTitle, !hasMedia && styles.feedItemTitleTextOnly]}>
                      {post.title}
                    </Text>
                  ) : hasMedia ? (
                    <Text style={styles.feedItemTitle} numberOfLines={1}>
                      {post.media_type === 'video' ? 'Video' : 'Fotoğraf'}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
          <TouchableOpacity onPress={() => {}} style={styles.showAllBtn}>
            <Text style={styles.showAllText}>Tümünü göster</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bildir modal: sebep + açıklama */}
      <Modal
        visible={!!reportPost}
        animationType="slide"
        transparent
        onRequestClose={() => setReportPost(null)}
      >
        <Pressable style={styles.reportModalOverlay} onPress={() => setReportPost(null)}>
          <Pressable style={styles.reportModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Paylaşımı bildir</Text>
              <TouchableOpacity onPress={() => setReportPost(null)} hitSlop={16}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.reportModalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.reportModalSubtitle}>Bildirim sebebi (zorunlu)</Text>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.reportReasonRow, reportReason === r.value && styles.reportReasonRowSelected]}
                  onPress={() => setReportReason(r.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={reportReason === r.value ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={reportReason === r.value ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <Text style={styles.reportReasonLabel}>{r.label}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.reportModalSubtitle}>Ek açıklama (isteğe bağlı)</Text>
              <TextInput
                style={styles.reportDetailsInput}
                placeholder="Detay yazabilirsiniz..."
                placeholderTextColor={theme.colors.textMuted}
                value={reportDetails}
                onChangeText={setReportDetails}
                multiline
                maxLength={300}
                editable={!submittingReport}
              />
              <TouchableOpacity
                style={[styles.reportSubmitBtn, (!reportReason.trim() || submittingReport) && styles.reportSubmitBtnDisabled]}
                onPress={submitReport}
                disabled={!reportReason.trim() || submittingReport}
                activeOpacity={0.8}
              >
                {submittingReport ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.reportSubmitBtnText}>Gönder</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Odam kartı */}
      {myRoom && (
        <>
          <Text style={styles.sectionTitle}>Odam</Text>
          <View style={styles.roomCard}>
            <View style={styles.roomCardAccent} />
            <View style={styles.roomCardInner}>
              <View style={styles.roomCardHeader}>
                <View style={styles.roomNumberBadge}>
                  <Ionicons name="bed-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.roomTitle}>Oda {myRoom.room_number}</Text>
                </View>
                {myRoom.view_type ? (
                  <View style={styles.roomViewChip}>
                    <Text style={styles.roomViewChipText}>{myRoom.view_type}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.roomDatesRow}>
                {myRoom.check_in_at && (
                  <View style={styles.roomDateItem}>
                    <Ionicons name="log-in-outline" size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.roomMeta}>{new Date(myRoom.check_in_at).toLocaleDateString('tr-TR')} · 14:00</Text>
                  </View>
                )}
                {myRoom.check_out_at && (
                  <View style={styles.roomDateItem}>
                    <Ionicons name="log-out-outline" size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.roomMeta}>{new Date(myRoom.check_out_at).toLocaleDateString('tr-TR')} · 11:00</Text>
                  </View>
                )}
              </View>
              <View style={styles.roomActions}>
                <TouchableOpacity style={styles.roomBtn} onPress={() => router.push('/customer/key')} activeOpacity={0.8}>
                  <Ionicons name="key-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.roomBtnText}>Dijital anahtar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.roomBtn} onPress={() => router.push('/customer/room-service/')} activeOpacity={0.8}>
                  <Ionicons name="restaurant-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.roomBtnText}>Oda servisi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.roomBtn} onPress={() => router.push('/(tabs)/messages')} activeOpacity={0.8}>
                  <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.roomBtnText}>Temizlik iste</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Gönderi medyası tam ekran (resim / video) — personel ile aynı */}
      <Modal
        visible={!!fullscreenPostMedia}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenPostMedia(null)}
      >
        <Pressable
          style={[styles.fullscreenOverlay, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
          onPress={() => setFullscreenPostMedia(null)}
        >
          {fullscreenPostMedia ? (
            <>
              <View style={styles.fullscreenImageWrap} pointerEvents="box-none">
                {fullscreenPostMedia.mediaType === 'video' ? (
                  <>
                    <Video
                      key={fullscreenPostMedia.uri}
                      ref={fullscreenVideoRef}
                      source={{ uri: fullscreenPostMedia.uri }}
                      usePoster={false}
                      style={[styles.fullscreenImage, styles.fullscreenVideo, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
                      useNativeControls={false}
                      resizeMode="contain"
                      isLooping={false}
                      shouldPlay
                      isMuted={false}
                      onLoad={() => {
                        setFullscreenVideoReady(true);
                        fullscreenVideoRef.current?.playAsync().catch(() => {});
                        fullscreenVideoRef.current?.setVolumeAsync(1.0).catch(() => {});
                      }}
                    />
                    {fullscreenPostMedia.posterUri && !fullscreenVideoReady ? (
                      <CachedImage
                        uri={fullscreenPostMedia.posterUri}
                        style={[StyleSheet.absoluteFillObject, styles.fullscreenPosterImage, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
                        contentFit="contain"
                        pointerEvents="none"
                      />
                    ) : null}
                  </>
                ) : (
                  <CachedImage
                    uri={fullscreenPostMedia.uri}
                    style={[styles.fullscreenImage, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
                    contentFit="contain"
                  />
                )}
              </View>
              <TouchableOpacity
                style={styles.fullscreenCloseBtn}
                onPress={() => setFullscreenPostMedia(null)}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Ionicons name="close-circle" size={40} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </>
          ) : null}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + 24 },
  welcomeBlock: { marginTop: 2, marginBottom: theme.spacing.lg },
  welcomeTitle: { ...theme.typography.title, color: theme.colors.text, marginBottom: 4 },
  welcomeLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  welcomeLocation: { ...theme.typography.bodySmall, color: theme.colors.textSecondary },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    letterSpacing: 0.3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    letterSpacing: 0.2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  shareBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  storyScroll: { marginHorizontal: -theme.spacing.lg },
  storyRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    gap: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  storyItem: {
    alignItems: 'center',
    width: 80,
  },
  storyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  storyAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  storyAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primaryLight + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatarLetter: { fontSize: 28, fontWeight: '700', color: theme.colors.primary },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  statusDotOnline: {},
  messageAvatarWrap: { position: 'relative', marginRight: 12 },
  messageOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  storyTextBlock: {
    width: '100%',
    minHeight: 36,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  storyName: { fontWeight: '600', fontSize: 12, color: theme.colors.text, textAlign: 'center' },
  storyDept: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, textAlign: 'center' },
  hotelCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
    position: 'relative',
  },
  hotelCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.colors.primary,
    borderTopLeftRadius: theme.radius.lg,
    borderBottomLeftRadius: theme.radius.lg,
  },
  hotelCardInner: { padding: theme.spacing.lg, paddingLeft: theme.spacing.lg + 4 },
  hotelCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  hotelIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${theme.colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hotelCardHead: { flex: 1 },
  hotelCardTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  hotelStarsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.full,
    backgroundColor: `${theme.colors.primary}20`,
  },
  hotelStarsText: { fontSize: 12, fontWeight: '600', color: theme.colors.primaryDark },
  hotelFacilities: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 14, lineHeight: 20 },
  hotelCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hotelCardLink: { color: theme.colors.primary, fontWeight: '600', fontSize: 14 },
  hotelQuickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  quickLinkText: { fontSize: 14, color: theme.colors.text, fontWeight: '600' },
  roomCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
    position: 'relative',
  },
  roomCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.colors.primary,
    borderTopLeftRadius: theme.radius.lg,
    borderBottomLeftRadius: theme.radius.lg,
  },
  roomCardInner: { padding: theme.spacing.lg, paddingLeft: theme.spacing.lg + 4 },
  roomCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  roomNumberBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  roomViewChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.borderLight,
  },
  roomViewChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  roomDatesRow: { gap: 8, marginBottom: 4 },
  roomDateItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomMeta: { fontSize: 13, color: theme.colors.textSecondary },
  roomActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  roomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: `${theme.colors.primary}14`,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}30`,
  },
  roomBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  messageList: { gap: 8 },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    ...theme.shadows.sm,
  },
  messageAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.borderLight },
  messageAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarLetter: { fontSize: 18, fontWeight: '700', color: theme.colors.primary },
  messageBody: { flex: 1 },
  messageLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  messageDept: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  feedList: { gap: 14 },
  feedItem: {
    flexDirection: 'column',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  feedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.borderLight,
  },
  feedAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '20',
  },
  feedAvatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  feedItemHeaderText: { flex: 1, minWidth: 0 },
  feedMenuBtn: { padding: 8 },
  feedAuthorName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuModalBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    minWidth: 200,
    overflow: 'hidden',
  },
  menuModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  menuModalItemText: { fontSize: 16, fontWeight: '500', color: theme.colors.text },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reportModalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  reportModalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  reportModalScroll: { paddingHorizontal: 20, paddingTop: 16 },
  reportModalSubtitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 10 },
  reportReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  reportReasonRowSelected: { backgroundColor: theme.colors.primaryLight + '30', borderRadius: 10 },
  reportReasonLabel: { fontSize: 15, color: theme.colors.text },
  reportDetailsInput: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  reportSubmitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportSubmitBtnDisabled: { opacity: 0.5 },
  reportSubmitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  postMediaTouchable: { width: '100%' },
  postImageWrap: { position: 'relative', width: '100%' },
  postImage: {
    width: '100%',
    height: SCREEN_WIDTH - 32,
    backgroundColor: theme.colors.borderLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  feedItemBody: { padding: 12, paddingTop: 4 },
  feedItemTitle: { fontWeight: '600', fontSize: 15, color: theme.colors.text },
  feedItemTitleTextOnly: { fontSize: 16, lineHeight: 24, marginBottom: 0 },
  feedItemMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  emptyFeed: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyFeedText: { color: theme.colors.textMuted },
  showAllBtn: { padding: theme.spacing.md, alignItems: 'center' },
  showAllText: { color: theme.colors.primary, fontWeight: '600', fontSize: 14 },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { backgroundColor: '#000' },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
  },
});
