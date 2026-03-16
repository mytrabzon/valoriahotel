import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

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
  shift?: { start_time: string; end_time: string } | null;
};
type Review = { id: string; rating: number; comment: string | null; created_at: string };

export default function StaffProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: s } = await supabase
        .from('staff')
        .select('id, full_name, department, position, profile_image, cover_image, bio, is_online, hire_date, average_rating, total_reviews, specialties, languages, shift_id')
        .eq('id', id)
        .single();
      setStaff(s ?? null);
      if (s?.shift_id) {
        const { data: shift } = await supabase.from('shifts').select('start_time, end_time').eq('id', s.shift_id).single();
        setStaff((prev) => (prev ? { ...prev, shift: shift ?? null } : null));
      }
      const { data: r } = await supabase.from('staff_reviews').select('id, rating, comment, created_at').eq('staff_id', id).order('created_at', { ascending: false }).limit(20);
      setReviews(r ?? []);
    };
    load();
  }, [id]);

  if (!staff) return <View style={styles.centered}><Text>Yükleniyor...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      {staff.cover_image ? (
        <Image source={{ uri: staff.cover_image }} style={styles.cover} />
      ) : (
        <View style={styles.coverPlaceholder} />
      )}
      <View style={styles.avatarWrap}>
        <Image source={{ uri: staff.profile_image || 'https://via.placeholder.com/120' }} style={styles.avatar} />
      </View>
      <View style={styles.header}>
        <Text style={styles.name}>{staff.full_name || 'Personel'}</Text>
        <Text style={styles.dept}>{staff.department || '—'}</Text>
        <View style={styles.onlineRow}>
          <View style={[styles.dot, staff.is_online ? styles.dotOn : styles.dotOff]} />
          <Text style={styles.onlineText}>{staff.is_online ? 'Aktif' : 'Çevrimdışı'}</Text>
        </View>
      </View>
      <View style={styles.section}>
        {staff.position && <Row label="Görev" value={staff.position} />}
        {staff.hire_date && <Row label="İşe Başlama" value={new Date(staff.hire_date).toLocaleDateString('tr-TR')} />}
        {staff.shift && <Row label="Mesai" value={`${staff.shift.start_time} - ${staff.shift.end_time}`} />}
        {staff.specialties?.length ? <Row label="Uzmanlık" value={staff.specialties.join(', ')} /> : null}
        {staff.languages?.length ? <Row label="Diller" value={staff.languages.join(', ')} /> : null}
      </View>
      {staff.bio && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hakkında</Text>
          <Text style={styles.bio}>{staff.bio}</Text>
        </View>
      )}
      {(staff.average_rating != null && staff.average_rating > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Puan</Text>
          <Text style={styles.rating}>★ {Number(staff.average_rating).toFixed(1)} ({staff.total_reviews ?? 0} değerlendirme)</Text>
        </View>
      )}
      {reviews.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Değerlendirmeler</Text>
          {reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}</Text>
              {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
            </View>
          ))}
        </View>
      )}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  cover: { width: '100%', height: 160 },
  coverPlaceholder: { width: '100%', height: 160, backgroundColor: '#e5e7eb' },
  avatarWrap: { alignItems: 'center', marginTop: -56 },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: '#fff', backgroundColor: '#f3f4f6' },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  name: { fontSize: 22, fontWeight: '700' },
  dept: { fontSize: 16, color: '#b8860b', marginTop: 4 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  dotOn: { backgroundColor: '#22c55e' },
  dotOff: { backgroundColor: '#9ca3af' },
  onlineText: { fontSize: 13, color: '#666' },
  section: { padding: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontSize: 14, color: '#6b7280' },
  rowValue: { fontSize: 14, fontWeight: '500' },
  bio: { fontSize: 14, color: '#374151', lineHeight: 22 },
  rating: { fontSize: 14, color: '#b8860b' },
  reviewCard: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 8 },
  reviewStars: { color: '#b8860b', marginBottom: 4 },
  reviewComment: { fontSize: 13, color: '#374151' },
});
