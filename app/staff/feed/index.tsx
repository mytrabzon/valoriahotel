import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  Pressable,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import { Video, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { theme } from '@/constants/theme';
import { StaffNameWithBadge, AvatarWithBadge } from '@/components/VerifiedBadge';
import { CachedImage } from '@/components/CachedImage';
import { formatDistanceToNow } from 'date-fns';
import { sendNotification, notifyAdmins } from '@/lib/notificationService';
import { tr } from 'date-fns/locale';
import { formatDateTime } from '@/lib/date';
import { log } from '@/lib/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam / tekrarlayan içerik' },
  { value: 'inappropriate', label: 'Uygunsuz içerik' },
  { value: 'violence', label: 'Şiddet veya tehdit' },
  { value: 'hate', label: 'Nefret söylemi veya ayrımcılık' },
  { value: 'false_info', label: 'Yanıltıcı bilgi' },
  { value: 'other', label: 'Diğer' },
];

function timeAgo(date: string | null | undefined): string {
  if (!date) return '';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: tr });
  } catch {
    return '';
  }
}

type FeedPostRow = {
  id: string;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  created_at: string;
  staff_id: string | null;
  staff: { full_name: string | null; department: string | null; profile_image: string | null; verification_badge?: 'blue' | 'yellow' | null } | null;
  guest_id?: string | null;
  guest?: { full_name: string | null } | null;
};

type ViewerRow = {
  id: string;
  staff_id: string;
  viewed_at: string;
  staff: { full_name: string | null; profile_image: string | null; verification_badge?: 'blue' | 'yellow' | null } | null;
};

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  staff: { full_name: string | null; verification_badge?: 'blue' | 'yellow' | null } | null;
};

type CommentWithPostId = CommentRow & { post_id: string };

type StaffAvatarRow = {
  id: string;
  full_name: string | null;
  profile_image: string | null;
  department: string | null;
  position: string | null;
  verification_badge?: 'blue' | 'yellow' | null;
};

export default function StaffHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openPostId?: string }>();
  const { staff } = useAuthStore();
  const [posts, setPosts] = useState<FeedPostRow[]>([]);
  const [staffList, setStaffList] = useState<StaffAvatarRow[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentRow[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<string | null>(null);
  const [togglingLike, setTogglingLike] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [notificationPrefs, setNotificationPrefs] = useState<Set<string>>(new Set());
  const [viewersModalPostId, setViewersModalPostId] = useState<string | null>(null);
  const [viewersList, setViewersList] = useState<ViewerRow[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [togglingNotif, setTogglingNotif] = useState<string | null>(null);
  const [fullscreenPostMedia, setFullscreenPostMedia] = useState<{
    uri: string;
    mediaType: 'image' | 'video';
    postId?: string;
    posterUri?: string;
  } | null>(null);
  const [fullscreenVideoReady, setFullscreenVideoReady] = useState(false);
  const fullscreenVideoRef = useRef<import('expo-av').Video>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [reportPost, setReportPost] = useState<FeedPostRow | null>(null);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [commentsSheetPostId, setCommentsSheetPostId] = useState<string | null>(null);
  const [commentSheetKeyboardH, setCommentSheetKeyboardH] = useState(0);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);

  const COMMENT_SHEET_INITIAL = Platform.OS === 'android' ? SCREEN_HEIGHT * 0.62 : SCREEN_HEIGHT * 0.5;
  const COMMENT_SHEET_MAX = SCREEN_HEIGHT * 0.9;
  const commentSheetHeight = useRef(new Animated.Value(COMMENT_SHEET_INITIAL)).current;
  const commentSheetCurrentH = useRef(COMMENT_SHEET_INITIAL);

  const commentSheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const newH = commentSheetCurrentH.current - g.dy;
        const clamped = Math.max(COMMENT_SHEET_INITIAL * 0.5, Math.min(COMMENT_SHEET_MAX, newH));
        commentSheetCurrentH.current = clamped;
        commentSheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const h = commentSheetCurrentH.current;
        const vy = g.vy;
        if (h < COMMENT_SHEET_INITIAL * 0.65 || vy > 0.4) {
          setCommentsSheetPostId(null);
          commentSheetCurrentH.current = COMMENT_SHEET_INITIAL;
          commentSheetHeight.setValue(COMMENT_SHEET_INITIAL);
          return;
        }
        const target = vy < -0.2 || h > COMMENT_SHEET_INITIAL * 1.1 ? COMMENT_SHEET_MAX : COMMENT_SHEET_INITIAL;
        commentSheetCurrentH.current = target;
        Animated.spring(commentSheetHeight, {
          toValue: target,
          useNativeDriver: false,
          tension: 80,
          friction: 12,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (commentsSheetPostId) {
      commentSheetCurrentH.current = COMMENT_SHEET_INITIAL;
      commentSheetHeight.setValue(COMMENT_SHEET_INITIAL);
    } else {
      setCommentSheetKeyboardH(0);
    }
  }, [commentsSheetPostId]);

  // Android: yorum kartında klavye açılınca titremeyi önlemek için KeyboardAvoidingView behavior kapatıldı, manuel padding
  useEffect(() => {
    if (Platform.OS !== 'android' || !commentsSheetPostId) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setCommentSheetKeyboardH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setCommentSheetKeyboardH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [commentsSheetPostId]);

  // Bildirimden tıklanınca ilgili gönderinin yorum kartını aç (openPostId)
  useEffect(() => {
    const postId = params.openPostId;
    if (postId) {
      setCommentsSheetPostId(postId);
      router.setParams({ openPostId: undefined });
    }
  }, [params.openPostId, router]);

  const loadStaffList = useCallback(async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, profile_image, department, position, verification_badge, email')
      .eq('is_active', true)
      .order('full_name');
    const rows = (data ?? []) as (StaffAvatarRow & { email?: string | null })[];
    const byKey = new Map<string, (StaffAvatarRow & { email?: string | null })>();
    rows.forEach((r) => {
      const key = (r.email && r.email.trim()) ? r.email.trim().toLowerCase() : r.id;
      if (!byKey.has(key)) byKey.set(key, r);
    });
    setStaffList(Array.from(byKey.values()).map(({ id, full_name, profile_image, department, position, verification_badge }) => ({
      id,
      full_name,
      profile_image,
      department,
      position,
      verification_badge,
    })) as StaffAvatarRow[]);
  }, []);

  const loadFeed = useCallback(async () => {
    if (!staff) return;
    loadStaffList();
    const { data: postsData } = await supabase
      .from('feed_posts')
      .select('id, media_type, media_url, thumbnail_url, title, created_at, staff_id, staff:staff_id(full_name, department, profile_image, verification_badge), guest_id, guest:guest_id(full_name)')
      .or('visibility.eq.all_staff,visibility.eq.my_team,visibility.eq.customers')
      .order('created_at', { ascending: false })
      .limit(50);
    const list = (postsData ?? []) as FeedPostRow[];
    if (!mountedRef.current) return;
    setPosts(list);
    setPlayingPreviewId(list.find((p) => p.media_type === 'video')?.id ?? null);
    const ids = list.map((p) => p.id);
    if (ids.length === 0) {
      setLikeCounts({});
      setCommentCounts({});
      setViewCounts({});
      setMyLikes(new Set());
      setNotificationPrefs(new Set());
      setCommentsByPost({});
      return;
    }
    const [reactionsRes, commentsRes, myReactionsRes, viewsRes, notifPrefsRes] = await Promise.all([
      supabase.from('feed_post_reactions').select('post_id').in('post_id', ids),
      supabase.from('feed_post_comments').select('post_id, id, content, created_at, staff:staff_id(full_name, verification_badge)').in('post_id', ids).order('created_at', { ascending: true }),
      supabase.from('feed_post_reactions').select('post_id').in('post_id', ids).eq('staff_id', staff.id),
      supabase.from('feed_post_views').select('post_id').in('post_id', ids),
      supabase.from('feed_post_notification_prefs').select('post_id').eq('staff_id', staff.id).in('post_id', ids),
    ]);
    if (!mountedRef.current) return;
    const reactions = (reactionsRes.data ?? []) as { post_id: string }[];
    const comments = (commentsRes.data ?? []) as CommentWithPostId[];
    const myReactions = (myReactionsRes.data ?? []) as { post_id: string }[];
    const views = (viewsRes.data ?? []) as { post_id: string }[];
    const notifPrefs = (notifPrefsRes.data ?? []) as { post_id: string }[];
    const likeCount: Record<string, number> = {};
    reactions.forEach((r) => {
      likeCount[r.post_id] = (likeCount[r.post_id] ?? 0) + 1;
    });
    const viewCount: Record<string, number> = {};
    views.forEach((v) => {
      viewCount[v.post_id] = (viewCount[v.post_id] ?? 0) + 1;
    });
    const commentCount: Record<string, number> = {};
    const byPost: Record<string, CommentRow[]> = {};
    comments.forEach((c) => {
      commentCount[c.post_id] = (commentCount[c.post_id] ?? 0) + 1;
      if (!byPost[c.post_id]) byPost[c.post_id] = [];
      byPost[c.post_id].push({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        staff: c.staff,
      });
    });
    setLikeCounts(likeCount);
    setCommentCounts(commentCount);
    setViewCounts(viewCount);
    setMyLikes(new Set(myReactions.map((r) => r.post_id)));
    setNotificationPrefs(new Set(notifPrefs.map((n) => n.post_id)));
    setCommentsByPost(byPost);
    const viewRows = ids.map((post_id) => ({ post_id, staff_id: staff.id }));
    supabase.from('feed_post_views').upsert(viewRows, { onConflict: 'post_id,staff_id', ignoreDuplicates: true }).then(() => {});
  }, [staff?.id, loadStaffList]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (fullscreenPostMedia?.mediaType === 'video') setFullscreenVideoReady(false);
  }, [fullscreenPostMedia?.uri, fullscreenPostMedia?.mediaType]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!fullscreenPostMedia || fullscreenPostMedia.mediaType !== 'video') return;
    const t = setTimeout(() => {
      fullscreenVideoRef.current?.playAsync().catch(() => {});
      fullscreenVideoRef.current?.setVolumeAsync(1.0).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [fullscreenPostMedia?.uri, fullscreenPostMedia?.mediaType]);

  useFocusEffect(
    useCallback(() => {
      if (staff?.id) loadFeed();
    }, [staff?.id, loadFeed])
  );

  useEffect(() => {
    const channel = supabase
      .channel('feed_posts_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_posts' },
        () => { loadFeed(); }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'feed_posts' },
        () => { loadFeed(); }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }, [loadFeed]);

  const toggleLike = async (postId: string, authorStaffId: string | null) => {
    if (!staff) return;
    setTogglingLike(postId);
    try {
      const liked = myLikes.has(postId);
      if (liked) {
        await supabase.from('feed_post_reactions').delete().eq('post_id', postId).eq('staff_id', staff.id);
        setMyLikes((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        setLikeCounts((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 1) - 1) }));
      } else {
        await supabase.from('feed_post_reactions').insert({ post_id: postId, staff_id: staff.id, reaction: 'like' });
        setMyLikes((prev) => new Set(prev).add(postId));
        setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
        if (authorStaffId && authorStaffId !== staff.id) {
          const res = await sendNotification({
            staffId: String(authorStaffId),
            title: 'Yeni beğeni',
            body: `${staff.full_name ?? 'Bir çalışan'} paylaşımını beğendi.`,
            category: 'staff',
            notificationType: 'feed_like',
            data: { screen: 'staff_feed', url: '/staff', postId },
          });
          if (res?.error) log.warn('StaffFeed', 'Beğeni bildirimi', res.error);
        }
      }
    } catch (e) {
      // ignore
    }
    setTogglingLike(null);
  };

  const submitComment = async (postId: string, authorStaffId: string | null) => {
    const text = (commentText[postId] ?? '').trim();
    if (!staff || !text) return;
    setPostingComment(postId);
    try {
      const { data: inserted } = await supabase
        .from('feed_post_comments')
        .insert({ post_id: postId, staff_id: staff.id, content: text })
        .select('id, content, created_at, staff_id')
        .single();
      setCommentText((prev) => ({ ...prev, [postId]: '' }));
      const newComment: CommentRow = {
        id: (inserted as { id: string }).id,
        content: text,
        created_at: (inserted as { created_at: string }).created_at,
        staff: { full_name: staff.full_name },
      };
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), newComment],
      }));
      setCommentCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
      const notifyBody = `${staff.full_name ?? 'Bir çalışan'}: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`;
      if (authorStaffId && authorStaffId !== staff.id) {
        const res = await sendNotification({
          staffId: String(authorStaffId),
          title: 'Yeni yorum',
          body: notifyBody,
          category: 'staff',
          notificationType: 'feed_comment',
          data: { screen: 'staff_feed', url: '/staff', postId },
        });
        if (res?.error) log.warn('StaffFeed', 'Yorum bildirimi', res.error);
      }
      let prefQ = supabase.from('feed_post_notification_prefs').select('staff_id').eq('post_id', postId).neq('staff_id', staff.id);
      if (authorStaffId) prefQ = prefQ.neq('staff_id', authorStaffId);
      const { data: prefRows } = await prefQ;
      const staffIdsToNotify = (prefRows ?? []).map((r: { staff_id: string }) => r.staff_id);
      for (const sid of staffIdsToNotify) {
        sendNotification({
          staffId: sid,
          title: 'Yeni yorum (takip ettiğin paylaşım)',
          body: notifyBody,
          category: 'staff',
          notificationType: 'feed_comment',
          data: { screen: 'staff_feed', url: '/staff', postId },
        }).catch(() => {});
      }
    } catch (e) {
      // ignore
    }
    setPostingComment(null);
  };

  const openViewersModal = async (postId: string) => {
    setViewersModalPostId(postId);
    setLoadingViewers(true);
    setViewersList([]);
    const { data } = await supabase
      .from('feed_post_views')
      .select('id, staff_id, viewed_at, staff:staff_id(full_name, profile_image, verification_badge)')
      .eq('post_id', postId)
      .order('viewed_at', { ascending: false });
    setViewersList((data ?? []) as ViewerRow[]);
    setLoadingViewers(false);
  };

  const toggleNotificationPref = async (postId: string) => {
    if (!staff) return;
    setTogglingNotif(postId);
    const isOn = notificationPrefs.has(postId);
    try {
      if (isOn) {
        await supabase.from('feed_post_notification_prefs').delete().eq('post_id', postId).eq('staff_id', staff.id);
        setNotificationPrefs((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      } else {
        await supabase.from('feed_post_notification_prefs').upsert(
          { post_id: postId, staff_id: staff.id },
          { onConflict: 'post_id,staff_id' }
        );
        setNotificationPrefs((prev) => new Set(prev).add(postId));
      }
    } catch (e) {
      // ignore
    }
    setTogglingNotif(null);
  };

  const isAdmin = staff?.role === 'admin';
  const canDeletePost = (post: FeedPostRow) => staff && (staff.id === post.staff_id || isAdmin);

  const handleDeletePost = (post: FeedPostRow) => {
    setMenuPostId(null);
    if (!canDeletePost(post)) return;
    Alert.alert(
      'Paylaşımı sil',
      'Bu paylaşımı silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setDeletingPostId(post.id);
            try {
              const { data, error } = await supabase
                .from('feed_posts')
                .delete()
                .eq('id', post.id)
                .select('id');
              if (error) {
                Alert.alert('Hata', error.message || 'Paylaşım silinemedi.');
                return;
              }
              if (data && data.length > 0) {
                setPosts((prev) => prev.filter((p) => p.id !== post.id));
              } else {
                Alert.alert('Hata', 'Paylaşım silinemedi. Yetkiniz olmayabilir.');
              }
            } catch (e) {
              Alert.alert('Hata', (e as Error).message || 'Bir hata oluştu.');
            } finally {
              setDeletingPostId(null);
            }
          },
        },
      ]
    );
  };

  const openReportModal = (post: FeedPostRow) => {
    setMenuPostId(null);
    setReportPost(post);
    setReportReason('');
    setReportDetails('');
  };

  const submitReport = async () => {
    if (!reportPost || !staff || !reportReason.trim()) return;
    const reasonLabel = REPORT_REASONS.find((r) => r.value === reportReason)?.label ?? reportReason;
    setSubmittingReport(true);
    try {
      const postTitle = (reportPost.title ?? '').trim() || 'Paylaşım';
      const reporterName = staff.full_name ?? 'Bir çalışan';
      const body = `${reporterName}: "${postTitle}" — ${reasonLabel}${reportDetails.trim() ? ` — ${reportDetails.trim()}` : ''}`;
      const { error: insertErr } = await supabase.from('feed_post_reports').insert({
        post_id: reportPost.id,
        reporter_staff_id: staff.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
        status: 'pending',
      });
      if (insertErr) {
        setSubmittingReport(false);
        Alert.alert('Hata', 'Bildirim kaydedilemedi. Lütfen tekrar deneyin.');
        return;
      }
      await notifyAdmins({
        title: 'Paylaşım bildirimi',
        body,
        data: {
          url: '/admin/reports',
          screen: 'admin',
          postId: reportPost.id,
          reason: reportReason,
          reporterStaffId: staff.id,
        },
      });
      setReportPost(null);
      setReportReason('');
      setReportDetails('');
      Alert.alert(
        'Bildiriminiz alındı',
        'Şikayetiniz yönetime iletildi. 24 saat içinde dönüş yapılacaktır.',
        [{ text: 'Tamam' }]
      );
    } catch (e) {
      Alert.alert('Hata', 'Bildirim gönderilemedi. Lütfen tekrar deneyin.');
    }
    setSubmittingReport(false);
  };

  const scrollRef = useRef<ScrollView>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const navigation = useNavigation();
  useEffect(() => {
    const parent = navigation.getParent();
    const unsub = parent?.addListener?.('tabPress', () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => (typeof unsub === 'function' ? unsub() : undefined);
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.white} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.feedHeader}>
          <TouchableOpacity onPress={() => router.push('/staff/feed/new')} style={styles.feedHeaderIconBtn} activeOpacity={0.8} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="add-circle" size={32} color="#b8860b" />
          </TouchableOpacity>
          <Text style={styles.feedHeaderTitle}>Akış</Text>
          <View style={styles.feedHeaderSpacer} />
        </View>

        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Hızlı işlemler</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/staff/expenses')} activeOpacity={0.8}>
              <Ionicons name="wallet" size={24} color={theme.colors.primary} />
              <Text style={styles.quickActionLabel}>Harcama</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/staff/stock/entry')} activeOpacity={0.8}>
              <Ionicons name="cube" size={24} color={theme.colors.primary} />
              <Text style={styles.quickActionLabel}>Stok girişi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/staff/tasks')} activeOpacity={0.8}>
              <Ionicons name="checkbox" size={24} color={theme.colors.primary} />
              <Text style={styles.quickActionLabel}>Görevler</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.staffAvatarsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.staffAvatarsContent}
          >
            {staffList.map((s) => {
              const name = s.full_name || '—';
              return (
                <TouchableOpacity
                  key={s.id}
                  style={styles.staffAvatarItem}
                  onPress={() => router.push(`/staff/profile/${s.id}`)}
                  activeOpacity={0.8}
                >
                  <AvatarWithBadge badge={s.verification_badge ?? null} avatarSize={56} badgeSize={12}>
                    {s.profile_image ? (
                      <CachedImage uri={s.profile_image} style={styles.staffAvatarImg} contentFit="cover" />
                    ) : (
                      <View style={styles.staffAvatarPlaceholder}>
                        <Text style={styles.staffAvatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                  </AvatarWithBadge>
                  <StaffNameWithBadge name={name} badge={s.verification_badge ?? null} textStyle={styles.staffAvatarName} />
                  {(s.department || s.position) ? (
                    <Text style={styles.staffAvatarRole} numberOfLines={1}>{s.department || s.position || ''}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {posts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Henüz paylaşım yok</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/staff/feed/new')} activeOpacity={0.8}>
              <Text style={styles.emptyBtnText}>İlk paylaşımı yap</Text>
            </TouchableOpacity>
          </View>
        ) : (
          posts.map((p) => {
            const likeCount = likeCounts[p.id] ?? 0;
            const commentCount = commentCounts[p.id] ?? 0;
            const viewCount = viewCounts[p.id] ?? 0;
            const liked = myLikes.has(p.id);
            const notifOn = notificationPrefs.has(p.id);
            const comments = commentsByPost[p.id] ?? [];
            const staffInfo = p.staff as { full_name?: string; profile_image?: string; verification_badge?: 'blue' | 'yellow' | null } | null;
            const rawGuest = p.guest;
            const guestInfo = Array.isArray(rawGuest) ? (rawGuest[0] as { full_name?: string | null } | null) : (rawGuest as { full_name?: string | null } | null);
            const isGuestPost = !p.staff_id;
            const authorName = staffInfo?.full_name ?? guestInfo?.full_name ?? (isGuestPost ? 'Misafir' : '—');
            const authorAvatar = staffInfo?.profile_image;
            const authorBadge = staffInfo?.verification_badge ?? null;
            const AuthorWrapper = p.staff_id ? TouchableOpacity : View;
            const authorWrapperProps = p.staff_id
              ? { onPress: () => router.push(`/staff/profile/${p.staff_id}`), activeOpacity: 0.7 }
              : {};
            return (
              <View key={p.id} style={styles.postCard}>
                <View style={styles.postHeaderRow}>
                  <AuthorWrapper style={styles.postHeader} {...authorWrapperProps}>
                    <AvatarWithBadge badge={authorBadge} avatarSize={40} badgeSize={12}>
                      {authorAvatar ? (
                        <CachedImage uri={authorAvatar} style={styles.postAuthorAvatarImage} contentFit="cover" />
                      ) : (
                        <View style={styles.postAuthorAvatar}>
                          <Text style={styles.postAuthorLetter}>{(authorName || '?').charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                    </AvatarWithBadge>
                    <View style={styles.postAuthorInfo}>
                      <StaffNameWithBadge name={authorName} badge={authorBadge} textStyle={styles.postAuthorName} />
                      <Text style={styles.postTime}>{timeAgo(p.created_at) || 'şimdi'}</Text>
                      <Text style={styles.postDateTime}>{formatDateTime(p.created_at)}</Text>
                      {isGuestPost ? <Text style={styles.postGuestLabel}>· Misafir</Text> : null}
                    </View>
                  </AuthorWrapper>
                  <TouchableOpacity
                    style={styles.postMenuBtn}
                    onPress={() => setMenuPostId(menuPostId === p.id ? null : p.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                    disabled={!!deletingPostId}
                  >
                    {deletingPostId === p.id ? (
                      <ActivityIndicator size="small" color={theme.colors.textMuted} />
                    ) : (
                      <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.text} />
                    )}
                  </TouchableOpacity>
                </View>
                {/* Menü modal: Sil / Bildir */}
                <Modal
                  visible={menuPostId === p.id}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setMenuPostId(null)}
                >
                  <Pressable style={styles.menuModalOverlay} onPress={() => setMenuPostId(null)}>
                    <View style={styles.menuModalBox}>
                      {canDeletePost(p) && (
                        <TouchableOpacity
                          style={styles.menuModalItem}
                          onPress={() => handleDeletePost(p)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={22} color={theme.colors.error} />
                          <Text style={[styles.menuModalItemText, { color: theme.colors.error }]}>Sil</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.menuModalItem}
                        onPress={() => openReportModal(p)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="flag-outline" size={22} color={theme.colors.text} />
                        <Text style={styles.menuModalItemText}>Bildir</Text>
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                </Modal>
                {p.media_type !== 'text' && (p.thumbnail_url || p.media_url) ? (
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => {
                      const isVideo = p.media_type === 'video';
                      if (isVideo) {
                        setFullscreenPostMedia({
                          uri: p.media_url || p.thumbnail_url || '',
                          mediaType: 'video',
                          postId: p.id,
                          posterUri: p.thumbnail_url || p.media_url || undefined,
                        });
                      } else {
                        setFullscreenPostMedia({
                          uri: p.thumbnail_url || p.media_url || '',
                          mediaType: 'image',
                          postId: p.id,
                        });
                      }
                    }}
                  >
                    <View style={styles.postImageWrap}>
                      {p.media_type === 'video' ? (
                        <Video
                          source={{ uri: p.media_url || p.thumbnail_url || '' }}
                          style={styles.postImage}
                          resizeMode="cover"
                          muted
                          shouldPlay={false}
                          useNativeControls={false}
                        />
                      ) : (
                        <CachedImage uri={p.thumbnail_url || p.media_url || ''} style={styles.postImage} contentFit="cover" />
                      )}
                    </View>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.postBody}>
                  {(p.title ?? '').trim() ? (
                    <Text style={styles.postTitle}>{p.title}</Text>
                  ) : null}
                  <View style={styles.postActions}>
                    <TouchableOpacity
                      style={styles.postActionBtn}
                      onPress={() => toggleLike(p.id, p.staff_id)}
                      disabled={!!togglingLike}
                      activeOpacity={0.7}
                    >
                      {togglingLike === p.id ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <Ionicons
                          name={liked ? 'heart' : 'heart-outline'}
                          size={26}
                          color={liked ? theme.colors.error : theme.colors.text}
                        />
                      )}
                      <Text style={styles.postActionCount}>{likeCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.postActionBtn}
                      onPress={() => setCommentsSheetPostId(commentsSheetPostId === p.id ? null : p.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-outline" size={22} color={theme.colors.text} />
                      <Text style={styles.postActionCount}>{commentCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.postActionBtn}
                      onPress={() => openViewersModal(p.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="eye-outline" size={22} color={theme.colors.text} />
                      <Text style={styles.postActionCount}>{viewCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.postActionBtn}
                      onPress={() => toggleNotificationPref(p.id)}
                      disabled={!!togglingNotif}
                      activeOpacity={0.7}
                    >
                      {togglingNotif === p.id ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <Ionicons
                          name={notifOn ? 'notifications' : 'notifications-outline'}
                          size={22}
                          color={notifOn ? theme.colors.primary : theme.colors.text}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bildir modal: sebep seçenekleri + açıklama */}
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

      <Modal
        visible={!!viewersModalPostId}
        animationType="slide"
        transparent
        onRequestClose={() => setViewersModalPostId(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setViewersModalPostId(null)}
        >
          <View
            style={[styles.viewersModalContent, { height: SCREEN_HEIGHT * 0.5 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.viewersModalHeader}>
              <Text style={styles.viewersModalTitle}>Görenler</Text>
              <TouchableOpacity onPress={() => setViewersModalPostId(null)} hitSlop={16}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            {loadingViewers ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={styles.viewersLoader} />
            ) : (
              <View style={styles.viewersListWrap}>
                <FlatList
                  data={viewersList}
                  keyExtractor={(item) => item.id}
                  ListEmptyComponent={<Text style={styles.viewersEmpty}>Henüz görüntüleyen yok</Text>}
                  renderItem={({ item }) => {
                    const v = item as ViewerRow;
                    const name = (v.staff as { full_name?: string } | null)?.full_name ?? '—';
                    const img = (v.staff as { profile_image?: string } | null)?.profile_image;
                    const badge = (v.staff as { verification_badge?: 'blue' | 'yellow' | null } | null)?.verification_badge ?? null;
                    return (
                      <View style={styles.viewerRow}>
                        <AvatarWithBadge badge={badge} avatarSize={44} badgeSize={12}>
                          {img ? (
                            <CachedImage uri={img} style={styles.viewerAvatar} contentFit="cover" />
                          ) : (
                            <View style={[styles.viewerAvatar, styles.viewerAvatarLetter]}>
                              <Text style={styles.viewerAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                        </AvatarWithBadge>
                        <View style={styles.viewerInfo}>
                          <StaffNameWithBadge name={name} badge={badge} textStyle={styles.viewerName} />
                          <Text style={styles.viewerTime}>{formatDateTime(v.viewed_at)}</Text>
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Yorum kartı: ekranın yarısına kadar açılır, aşağı yukarı kaydırılabilir; Android'de klavye yüksekliği manuel padding ile (titreme önlenir) */}
      <Modal
        visible={!!commentsSheetPostId}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsSheetPostId(null)}
      >
        <KeyboardAvoidingView
          style={styles.commentSheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setCommentsSheetPostId(null)} />
          <Animated.View
            style={[
              styles.commentSheetCard,
              { height: commentSheetHeight },
              Platform.OS === 'android' && commentSheetKeyboardH > 0 && { paddingBottom: commentSheetKeyboardH + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Pressable style={styles.commentSheetHandleWrap} {...commentSheetPanResponder.panHandlers}>
              <View style={styles.commentSheetHandle} />
            </Pressable>
            <View style={styles.commentSheetHeader}>
              <Text style={styles.commentSheetTitle}>Yorumlar</Text>
              <TouchableOpacity onPress={() => setCommentsSheetPostId(null)} hitSlop={16}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            {commentsSheetPostId && (() => {
              const post = posts.find((x) => x.id === commentsSheetPostId);
              const comments = commentsByPost[commentsSheetPostId] ?? [];
              if (!post) return null;
              return (
                <>
                  <ScrollView
                    style={styles.commentSheetScroll}
                    contentContainerStyle={styles.commentSheetScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {comments.length === 0 ? (
                      <Text style={styles.commentSheetEmpty}>Henüz yorum yok. İlk yorumu sen yap.</Text>
                    ) : (
                      comments.map((c) => (
                        <View key={c.id} style={styles.commentSheetRow}>
                          <StaffNameWithBadge
                            name={(c.staff as { full_name?: string } | null)?.full_name ?? '—'}
                            badge={(c.staff as { verification_badge?: 'blue' | 'yellow' | null } | null)?.verification_badge ?? null}
                            textStyle={styles.commentSheetAuthor}
                          />
                          <Text style={styles.commentSheetText}>{c.content}</Text>
                          <Text style={styles.commentSheetTime}>{timeAgo(c.created_at)}</Text>
                        </View>
                      ))
                    )}
                  </ScrollView>
                  <View style={styles.commentSheetInputRow}>
                    <TextInput
                      style={styles.commentSheetInput}
                      placeholder="Yorum yaz..."
                      placeholderTextColor={theme.colors.textMuted}
                      value={commentText[post.id] ?? ''}
                      onChangeText={(t) => setCommentText((prev) => ({ ...prev, [post.id]: t }))}
                      multiline
                      maxLength={500}
                      editable={postingComment !== post.id}
                    />
                    <TouchableOpacity
                      style={[styles.commentSendBtn, (!(commentText[post.id] ?? '').trim() || postingComment === post.id) && styles.commentSendBtnDisabled]}
                      onPress={() => submitComment(post.id, post.staff_id)}
                      disabled={!(commentText[post.id] ?? '').trim() || postingComment === post.id}
                      activeOpacity={0.8}
                    >
                      {postingComment === post.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="send" size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Gönderi medyası tam ekran: yükleme çubuğu, sol/sağ tıkla sarma, yorum kartı birlikte açılır */}
      <Modal
        visible={!!fullscreenPostMedia}
        transparent
        animationType="fade"
        onRequestClose={() => { setFullscreenPostMedia(null); setCommentsSheetPostId(null); }}
      >
        <Pressable
          style={[styles.fullscreenOverlay, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
          onPress={() => { setFullscreenPostMedia(null); setCommentsSheetPostId(null); }}
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
                      progressUpdateIntervalMillis={500}
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
                    <View style={styles.fullscreenSeekZones} pointerEvents="box-none">
                      <Pressable
                        style={styles.fullscreenSeekZoneLeft}
                        onPress={(e) => {
                          e.stopPropagation();
                          fullscreenVideoRef.current?.getStatusAsync().then((s) => {
                            if (s.isLoaded && 'positionMillis' in s) {
                              const pos = Math.max(0, (s.positionMillis ?? 0) - 10000);
                              fullscreenVideoRef.current?.setPositionAsync(pos);
                            }
                          });
                        }}
                      />
                      <Pressable style={styles.fullscreenSeekZoneCenter} onPress={() => { setFullscreenPostMedia(null); setCommentsSheetPostId(null); }} />
                      <Pressable
                        style={styles.fullscreenSeekZoneRight}
                        onPress={(e) => {
                          e.stopPropagation();
                          fullscreenVideoRef.current?.getStatusAsync().then((s) => {
                            if (s.isLoaded && 'positionMillis' in s) {
                              const dur = (s as { durationMillis?: number }).durationMillis ?? 0;
                              const pos = Math.min(dur, (s.positionMillis ?? 0) + 10000);
                              fullscreenVideoRef.current?.setPositionAsync(pos);
                            }
                          });
                        }}
                      />
                    </View>
                  </>
                ) : (
                  <CachedImage
                    uri={fullscreenPostMedia.uri}
                    style={[styles.fullscreenImage, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
                    contentFit="contain"
                  />
                )}
              </View>
            </>
          ) : null}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  feedHeaderIconBtn: { padding: 4, marginRight: 12 },
  feedHeaderTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, flex: 1 },
  feedHeaderSpacer: { width: 36 },
  quickActionsSection: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  quickActionsTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 10 },
  quickActionsRow: { flexDirection: 'row', gap: 12 },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: 12,
  },
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.text, marginTop: 4 },
  staffAvatarsSection: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  staffAvatarsContent: { paddingHorizontal: 16, alignItems: 'center', paddingRight: 24 },
  staffAvatarItem: { alignItems: 'center', width: 72, marginRight: 16 },
  staffAvatarImg: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.borderLight },
  staffAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffAvatarLetter: { fontSize: 22, fontWeight: '700', color: theme.colors.white },
  staffAvatarName: { fontSize: 12, fontWeight: '600', color: theme.colors.text, marginTop: 6, maxWidth: 72 },
  staffAvatarRole: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2, maxWidth: 72 },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: { fontSize: 16, color: theme.colors.textMuted, marginTop: 16 },
  emptyBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
  postCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    paddingBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
  postHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  postMenuBtn: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuModalBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    minWidth: 200,
    paddingVertical: 8,
    ...theme.shadows.lg,
  },
  menuModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuModalItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reportModalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  reportModalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  reportModalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  reportReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: theme.radius.md,
  },
  reportReasonRowSelected: {
    backgroundColor: `${theme.colors.primary}14`,
  },
  reportReasonLabel: { fontSize: 15, color: theme.colors.text, flex: 1 },
  reportDetailsInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.backgroundSecondary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  reportSubmitBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportSubmitBtnDisabled: { opacity: 0.5 },
  reportSubmitBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.white },
  postAuthorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAuthorAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAuthorLetter: { fontSize: 18, fontWeight: '700', color: theme.colors.white },
  postAuthorInfo: { flex: 1, minWidth: 0 },
  postAuthorName: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  postTime: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  postDateTime: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  postGuestLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  viewersModalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  viewersListWrap: {
    flex: 1,
    minHeight: 0,
  },
  viewersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  viewersModalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  viewersLoader: { marginVertical: 40 },
  viewersEmpty: { fontSize: 15, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 32 },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  viewerAvatarLetter: {
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerAvatarText: { fontSize: 18, fontWeight: '700', color: theme.colors.white },
  viewerInfo: { flex: 1, minWidth: 0 },
  viewerName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  viewerTime: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
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
  postBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  postTitle: { fontSize: 16, color: theme.colors.text, marginBottom: 14, lineHeight: 24 },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  postActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionCount: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  commentsBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderLight,
  },
  commentRow: { marginBottom: 10 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  commentText: { fontSize: 14, color: theme.colors.text, marginTop: 2 },
  commentTime: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  commentSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendBtnDisabled: { opacity: 0.5 },
  commentSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  commentSheetCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  commentSheetHandleWrap: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  commentSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderLight,
  },
  commentSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  commentSheetTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  commentSheetScroll: { flex: 1, minHeight: 0 },
  commentSheetScrollContent: { padding: 20, paddingBottom: 16 },
  commentSheetEmpty: { fontSize: 15, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  commentSheetRow: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  commentSheetAuthor: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  commentSheetText: { fontSize: 15, color: theme.colors.text, marginTop: 4, lineHeight: 22 },
  commentSheetTime: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  commentSheetInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  commentSheetInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  bottomSpacer: { height: 24 },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: {},
  fullscreenVideo: { backgroundColor: '#000' },
  fullscreenPosterImage: { backgroundColor: 'transparent' },
  fullscreenSeekZones: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  fullscreenSeekZoneLeft: { flex: 1 },
  fullscreenSeekZoneCenter: { flex: 1 },
  fullscreenSeekZoneRight: { flex: 1 },
});
