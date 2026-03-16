import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

type StaffProfile = {
  id: string;
  full_name: string | null;
  department: string | null;
  profile_image: string | null;
  cover_image: string | null;
  bio: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  is_online: boolean | null;
  total_reviews: number | null;
  average_rating: number | null;
  position: string | null;
  shift?: { start_time: string; end_time: string } | null;
};

export default function StaffProfileScreen() {
  const { staff: authStaff } = useAuthStore();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authStaff?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name, department, profile_image, cover_image, bio, specialties, languages, is_online, total_reviews, average_rating, position, shift_id')
        .eq('id', authStaff.id)
        .single();
      if (data) {
        setProfile({ ...data, shift: null });
        if (data.shift_id) {
          const { data: shift } = await supabase.from('shifts').select('start_time, end_time').eq('id', data.shift_id).single();
          setProfile((p) => (p ? { ...p, shift } : null));
        }
      }
    };
    load();
  }, [authStaff?.id]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled || !result.assets[0].base64 || !profile) return;
      setUploading(true);
      const arrayBuffer = decode(result.assets[0].base64);
      const fileName = `staff/${profile.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('profiles').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(fileName);
      await supabase.from('staff').update({ profile_image: publicUrl }).eq('id', profile.id);
      setProfile((p) => (p ? { ...p, profile_image: publicUrl } : null));
    } catch (e) {
      Alert.alert('Hata', 'Resim yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const updateOnline = async (value: boolean) => {
    if (!profile) return;
    await supabase.from('staff').update({ is_online: value, last_active: new Date().toISOString() }).eq('id', profile.id);
    setProfile((p) => (p ? { ...p, is_online: value } : null));
  };

  const saveField = async (field: 'bio' | 'specialties' | 'languages', value: string) => {
    if (!profile) return;
    const payload =
      field === 'specialties' || field === 'languages'
        ? { [field]: value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [] }
        : { [field]: value || null };
    await supabase.from('staff').update(payload).eq('id', profile.id);
    setProfile((p) => (p ? { ...p, ...payload } : null));
  };

  if (!profile) return <View style={styles.centered}><Text>Yükleniyor...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.coverWrap} onPress={() => {}}>
        {profile.cover_image ? (
          <Image source={{ uri: profile.cover_image }} style={styles.cover} />
        ) : (
          <View style={styles.coverPlaceholder}><Text style={styles.coverPlaceholderText}>Kapak fotoğrafı</Text></View>
        )}
      </TouchableOpacity>
      <View style={styles.avatarWrap}>
        <TouchableOpacity onPress={pickImage} disabled={uploading}>
          <Image source={{ uri: profile.profile_image || 'https://via.placeholder.com/120' }} style={styles.avatar} />
          {uploading && <View style={styles.uploadOverlay}><Text style={styles.uploadText}>Yükleniyor</Text></View>}
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{profile.full_name || '—'}</Text>
        <Text style={styles.dept}>{profile.department || '—'}</Text>

        <Text style={styles.label}>Biyografi</Text>
        <TextInput
          style={styles.input}
          value={profile.bio ?? ''}
          onChangeText={(t) => setProfile((p) => (p ? { ...p, bio: t } : null))}
          onBlur={() => saveField('bio', profile.bio ?? '')}
          placeholder="Kısa biyografi"
          multiline
        />

        <Text style={styles.label}>Uzmanlıklar (virgülle)</Text>
        <TextInput
          style={styles.input}
          value={profile.specialties?.join(', ') ?? ''}
          onChangeText={(t) => setProfile((p) => (p ? { ...p, specialties: t ? t.split(',').map((s) => s.trim()) : [] } : null))}
          onBlur={() => saveField('specialties', profile.specialties?.join(', ') ?? '')}
          placeholder="Örn: Konaklama, Resepsiyon"
        />

        <Text style={styles.label}>Diller</Text>
        <TextInput
          style={styles.input}
          value={profile.languages?.join(', ') ?? ''}
          onChangeText={(t) => setProfile((p) => (p ? { ...p, languages: t ? t.split(',').map((s) => s.trim()) : [] } : null))}
          onBlur={() => saveField('languages', profile.languages?.join(', ') ?? '')}
          placeholder="Örn: Türkçe, İngilizce"
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Aktif (görünsün)</Text>
          <Switch value={profile.is_online ?? false} onValueChange={updateOnline} trackColor={{ true: '#b8860b' }} />
        </View>

        {profile.shift && (
          <View style={styles.shiftBox}>
            <Text style={styles.label}>Bugünkü vardiya</Text>
            <Text>{profile.shift.start_time} – {profile.shift.end_time}</Text>
          </View>
        )}

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{profile.total_reviews ?? 0}</Text><Text style={styles.statLabel}>Değerlendirme</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{(profile.average_rating ?? 0).toFixed(1)}</Text><Text style={styles.statLabel}>Puan</Text></View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  coverWrap: { height: 140 },
  cover: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { color: '#9ca3af' },
  avatarWrap: { alignItems: 'center', marginTop: -50 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff', backgroundColor: '#f3f4f6' },
  uploadOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  uploadText: { color: '#fff', fontSize: 12 },
  body: { padding: 20 },
  name: { fontSize: 22, fontWeight: '700' },
  dept: { fontSize: 14, color: '#666', marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10 },
  shiftBox: { marginTop: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 10 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 24, padding: 16, backgroundColor: '#f9fafb', borderRadius: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#b8860b' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
});
