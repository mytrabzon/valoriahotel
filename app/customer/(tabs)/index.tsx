import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type StaffRow = {
  id: string;
  full_name: string | null;
  department: string | null;
  profile_image: string | null;
  is_online: boolean | null;
  last_active: string | null;
};

type HotelInfoRow = {
  id: string;
  name: string | null;
  description: string | null;
};

export default function CustomerHome() {
  const router = useRouter();
  const [activeStaff, setActiveStaff] = useState<StaffRow[]>([]);
  const [hotelInfo, setHotelInfo] = useState<HotelInfoRow | null>(null);

  useEffect(() => {
    loadActiveStaff();
    loadHotelInfo();
  }, []);

  const loadActiveStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, department, profile_image, is_online, last_active')
      .eq('is_active', true)
      .eq('is_online', true)
      .order('last_active', { ascending: false });
    setActiveStaff(data ?? []);
  };

  const loadHotelInfo = async () => {
    const { data } = await supabase.from('hotel_info').select('id, name, description').limit(1).single();
    setHotelInfo(data ?? null);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Valoria Hotel</Text>
        <Text style={styles.headerSubtitle}>Hoş geldiniz</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Şu Anda Aktif Çalışanlar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesRow}>
          {activeStaff.map((staff) => (
            <TouchableOpacity
              key={staff.id}
              style={styles.storyItem}
              onPress={() => router.push({ pathname: '/customer/staff/[id]', params: { id: staff.id } })}
            >
              <View style={styles.avatarWrap}>
                <Image
                  source={{ uri: staff.profile_image || 'https://via.placeholder.com/80' }}
                  style={styles.avatar}
                />
                {staff.is_online && <View style={styles.onlineBadge} />}
              </View>
              <Text style={styles.staffName} numberOfLines={1}>{staff.full_name || 'Personel'}</Text>
              <Text style={styles.staffDept} numberOfLines={1}>{staff.department || '—'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Otel Hakkında</Text>
        <TouchableOpacity style={styles.hotelCard} onPress={() => router.push('/customer/hotel/')}>
          <Text style={styles.hotelDesc} numberOfLines={3}>
            {hotelInfo?.description || 'Lüks konaklama deneyimi. Misafirlerimize en iyi hizmeti sunuyoruz.'}
          </Text>
          <Text style={styles.hotelLink}>Devamını oku →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Özel Teklifler</Text>
        <Text style={styles.placeholder}>Yakında...</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: '#b8860b', padding: 24 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  section: { paddingVertical: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  storiesRow: { marginHorizontal: -16 },
  storyItem: { alignItems: 'center', marginRight: 20 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#b8860b' },
  onlineBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff',
  },
  staffName: { marginTop: 6, fontWeight: '600', fontSize: 13 },
  staffDept: { fontSize: 11, color: '#666' },
  hotelCard: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12 },
  hotelDesc: { fontSize: 14, color: '#374151', lineHeight: 22 },
  hotelLink: { color: '#b8860b', marginTop: 8, fontWeight: '600' },
  placeholder: { color: '#9ca3af', fontSize: 14 },
});
