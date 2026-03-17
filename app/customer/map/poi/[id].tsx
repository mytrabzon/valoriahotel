/**
 * POI detay - Adres, telefon (tıklanabilir), web, saatler, puan, yorumlar, yol tarifi.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getPoiIcon, getPoiTypeLabel, getPoiCache, type Poi } from '@/lib/map/pois';
import { theme } from '@/constants/theme';
import { CachedImage } from '@/components/CachedImage';

type PoiReview = {
  id: string;
  author_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

export default function PoiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [poi, setPoi] = useState<Poi | null>(null);
  const [reviews, setReviews] = useState<PoiReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const isUuid = /^[0-9a-f-]{36}$/i.test(id);
      let p = null;
      if (isUuid) {
        const { data, error } = await supabase
          .from('pois')
          .select('id, external_id, name, type, lat, lng, address, phone, website, hours, rating, reviews_count, image_url, source')
          .eq('id', id)
          .single();
        if (!error && data) p = data;
      } else {
        const { data, error } = await supabase
          .from('pois')
          .select('id, external_id, name, type, lat, lng, address, phone, website, hours, rating, reviews_count, image_url, source')
          .eq('external_id', id)
          .maybeSingle();
        if (!error && data) p = data;
      }
      if (p) setPoi(p as Poi);
      if (!p) {
        const cached = getPoiCache(id);
        if (cached) setPoi(cached);
      }

      const { data: r } = await supabase
        .from('poi_reviews')
        .select('id, author_name, rating, comment, created_at')
        .eq('poi_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      setReviews((r ?? []) as PoiReview[]);
      setLoading(false);
    })();
  }, [id]);

  if (loading || !poi) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const starDisplay = poi.rating != null ? Number(poi.rating).toFixed(1) : null;
  const reviewsCount = poi.reviews_count ?? reviews.length;

  const openPhone = () => {
    if (!poi.phone) return;
    const tel = poi.phone.replace(/\s/g, '');
    Linking.openURL(`tel:${tel}`);
  };

  const openWebsite = () => {
    if (!poi.website) return;
    let url = poi.website;
    if (!url.startsWith('http')) url = 'https://' + url;
    Linking.openURL(url);
  };

  const openDirections = () => {
    const hotelLat = process.env.EXPO_PUBLIC_HOTEL_LAT ?? '40.6144';
    const hotelLon = process.env.EXPO_PUBLIC_HOTEL_LON ?? '40.31188';
    router.push({
      pathname: '/customer/map/directions',
      params: {
        fromLat: hotelLat,
        fromLng: hotelLon,
        toLat: String(poi.lat),
        toLng: String(poi.lng),
        toName: poi.name,
        toId: poi.id,
      },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.icon}>{getPoiIcon(poi.type)}</Text>
        <Text style={styles.name}>{poi.name}</Text>
        {(starDisplay || reviewsCount > 0) && (
          <Text style={styles.rating}>
            {'⭐'.repeat(Math.round(Number(poi.rating) || 0))} {starDisplay ?? '—'} ({reviewsCount} yorum)
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={openDirections}>
          <Text style={styles.actionBtnText}>📍 Yol tarifi</Text>
        </TouchableOpacity>
        {poi.phone && (
          <TouchableOpacity style={styles.actionBtn} onPress={openPhone}>
            <Text style={styles.actionBtnText}>📞 Ara</Text>
          </TouchableOpacity>
        )}
        {poi.website && (
          <TouchableOpacity style={styles.actionBtn} onPress={openWebsite}>
            <Text style={styles.actionBtnText}>🌐 Web</Text>
          </TouchableOpacity>
        )}
      </View>

      {poi.address && (
        <View style={styles.row}>
          <Text style={styles.label}>📍 Adres</Text>
          <Text style={styles.value}>{poi.address}</Text>
        </View>
      )}
      {poi.phone && (
        <View style={styles.row}>
          <Text style={styles.label}>📞 Telefon</Text>
          <TouchableOpacity onPress={openPhone}>
            <Text style={[styles.value, styles.link]}>{poi.phone}</Text>
          </TouchableOpacity>
        </View>
      )}
      {poi.website && (
        <View style={styles.row}>
          <Text style={styles.label}>🌐 Web</Text>
          <TouchableOpacity onPress={openWebsite}>
            <Text style={[styles.value, styles.link]} numberOfLines={1}>{poi.website}</Text>
          </TouchableOpacity>
        </View>
      )}
      {poi.hours && (
        <View style={styles.row}>
          <Text style={styles.label}>⏰ Çalışma saatleri</Text>
          <Text style={styles.value}>{poi.hours}</Text>
        </View>
      )}

      {poi.image_url && (
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>📸 Fotoğraf</Text>
          <CachedImage uri={poi.image_url} style={styles.photo} contentFit="cover" />
        </View>
      )}

      <View style={styles.reviewsSection}>
        <Text style={styles.sectionTitle}>⭐ Yorumlar</Text>
        {reviews.length === 0 ? (
          <Text style={styles.emptyReviews}>Henüz uygulama içi yorum yok.</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <Text style={styles.reviewAuthor}>{r.author_name ?? 'Anonim'} · {'⭐'.repeat(r.rating)}</Text>
              {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
              <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('tr-TR')}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: theme.spacing.xl },
  icon: { fontSize: 48, marginBottom: 8 },
  name: { ...theme.typography.title, color: theme.colors.text, marginBottom: 4 },
  rating: { fontSize: 14, color: theme.colors.textSecondary },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
  },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  row: { marginBottom: theme.spacing.md },
  label: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },
  value: { fontSize: 15, color: theme.colors.text },
  link: { color: theme.colors.primary, textDecorationLine: 'underline' },
  photoSection: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.xl },
  sectionTitle: { ...theme.typography.titleSmall, color: theme.colors.text, marginBottom: theme.spacing.md },
  photo: { width: '100%', height: 200, borderRadius: theme.radius.md, backgroundColor: theme.colors.borderLight },
  reviewsSection: { marginTop: theme.spacing.lg },
  emptyReviews: { fontSize: 14, color: theme.colors.textMuted },
  reviewCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  reviewAuthor: { fontWeight: '600', fontSize: 14, color: theme.colors.text },
  reviewComment: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  reviewDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
});
