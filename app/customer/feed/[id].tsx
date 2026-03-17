import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { StaffNameWithBadge } from '@/components/VerifiedBadge';
import { CachedImage } from '@/components/CachedImage';

type PostRow = {
  id: string;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  created_at: string;
  staff: { full_name: string | null; department: string | null; verification_badge?: 'blue' | 'yellow' | null } | null;
  guest: { full_name: string | null } | null;
};

export default function CustomerFeedPostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: winWidth } = useWindowDimensions();
  const [post, setPost] = useState<PostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Paylaşım bulunamadı.');
      return;
    }
    setVideoLoading(true);
    (async () => {
      const { data, error: e } = await supabase
        .from('feed_posts')
        .select('id, media_type, media_url, thumbnail_url, title, created_at, staff:staff_id(full_name, department, verification_badge), guest:guest_id(full_name)')
        .eq('id', id)
        .eq('visibility', 'customers')
        .maybeSingle();
      if (e) {
        setError('Yüklenemedi.');
        setPost(null);
      } else {
        setPost(data as PostRow | null);
        setError(data ? null : 'Paylaşım bulunamadı.');
      }
      setLoading(false);
    })();
  }, [id]);

  // Video yüklenme overlay'ı bazen onLoad tetiklenmeyebilir; bir süre sonra kaldır
  useEffect(() => {
    if (!post || post.media_type !== 'video') return;
    const t = setTimeout(() => setVideoLoading(false), 4000);
    return () => clearTimeout(t);
  }, [post?.id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Paylaşım bulunamadı.'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Geri dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rawStaff = post.staff as { full_name?: string; department?: string; verification_badge?: 'blue' | 'yellow' | null } | null;
  const rawGuest = post.guest as { full_name?: string | null } | null;
  const staffInfo = Array.isArray(rawStaff) ? rawStaff[0] ?? null : rawStaff;
  const guestInfo = Array.isArray(rawGuest) ? rawGuest[0] ?? null : rawGuest;
  const authorName = (staffInfo?.full_name ?? guestInfo?.full_name ?? 'Misafir').trim() || 'Misafir';
  const staffName = staffInfo ? authorName : (guestInfo ? authorName : 'Misafir');
  const dept = staffInfo?.department;
  const badge = staffInfo?.verification_badge ?? null;
  const imageUri = post.media_type !== 'text' ? (post.thumbnail_url || post.media_url) : null;
  const mediaUri = post.media_type === 'image' ? post.media_url : (post.thumbnail_url || post.media_url);
  const isVideo = post.media_type === 'video';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        {imageUri || mediaUri ? (
          isVideo ? (
            <View style={[styles.mediaWrap, { width: winWidth - 32 }]}>
              <Video
                source={{ uri: post.media_url ?? undefined }}
                style={styles.video}
                useNativeControls
                resizeMode="contain"
                isLooping={false}
                onLoad={() => setVideoLoading(false)}
                onError={() => setVideoLoading(false)}
              />
              {videoLoading && (
                <View style={styles.videoLoadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.videoLoadingText}>Yükleniyor...</Text>
                </View>
              )}
            </View>
          ) : (
            <CachedImage
              uri={mediaUri ?? undefined}
              style={[styles.image, { width: winWidth - 32 }]}
              contentFit="cover"
            />
          )
        ) : (
          <View style={[styles.textOnlyBlock, { width: winWidth - 32 }]}>
            <Text style={styles.textOnlyTitle}>{post.title || 'Metin paylaşımı'}</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title}>{post.title || (isVideo ? 'Video' : post.media_type === 'text' ? 'Metin' : 'Fotoğraf')}</Text>
          <View style={styles.metaRow}>
            <StaffNameWithBadge name={staffName} badge={badge} textStyle={styles.metaText} />
            {dept ? <Text style={styles.metaText}> · {dept}</Text> : guestInfo ? <Text style={styles.metaText}> · Misafir</Text> : null}
          </View>
          <Text style={styles.date}>{new Date(post.created_at).toLocaleString('tr-TR')}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={theme.colors.primary} />
        <Text style={styles.backBtnText}>Geri</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.backgroundSecondary },
  errorText: { fontSize: 16, color: theme.colors.textMuted, marginBottom: 16 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  mediaWrap: { aspectRatio: 1, backgroundColor: theme.colors.borderLight },
  video: { width: '100%', height: '100%' },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLoadingText: { marginTop: 8, fontSize: 14, color: theme.colors.textSecondary },
  image: { aspectRatio: 1, backgroundColor: theme.colors.borderLight },
  textOnlyBlock: { padding: theme.spacing.xl, backgroundColor: theme.colors.borderLight + '60', minHeight: 120, justifyContent: 'center' },
  textOnlyTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  body: { padding: theme.spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  metaText: { fontSize: 14, color: theme.colors.textSecondary },
  date: { fontSize: 12, color: theme.colors.textMuted },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
});
