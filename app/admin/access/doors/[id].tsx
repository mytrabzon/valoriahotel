import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const DOOR_TYPES = [
  { value: 'room', label: 'Oda' },
  { value: 'parking', label: 'Otopark' },
  { value: 'pool', label: 'Havuz' },
  { value: 'gym', label: 'Spor salonu' },
  { value: 'staff', label: 'Personel girişi' },
  { value: 'storage', label: 'Depo' },
  { value: 'other', label: 'Diğer' },
];

type RoomRow = { id: string; room_number: string };

export default function EditDoorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [door_type, setDoorType] = useState<'room' | 'parking' | 'pool' | 'gym' | 'staff' | 'storage' | 'other'>('room');
  const [room_id, setRoomId] = useState<string | null>(null);
  const [sort_order, setSortOrder] = useState('');
  const [is_active, setIsActive] = useState(true);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    supabase.from('rooms').select('id, room_number').order('room_number').then(({ data }) => setRooms(data ?? []));
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from('doors').select('*').eq('id', id).single();
      if (error || !data) {
        setFetching(false);
        Alert.alert('Hata', 'Kapı bulunamadı.');
        return;
      }
      setName(data.name ?? '');
      setDoorType((data.door_type as typeof door_type) ?? 'room');
      setRoomId(data.room_id ?? null);
      setSortOrder(String(data.sort_order ?? 0));
      setIsActive(data.is_active ?? true);
      setFetching(false);
    })();
  }, [id]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Hata', 'Kapı adı girin.');
      return;
    }
    if (door_type === 'room' && !room_id) {
      Alert.alert('Hata', 'Oda tipi için bir oda seçin.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('doors')
        .update({
          name: trimmed,
          door_type,
          room_id: door_type === 'room' ? room_id : null,
          sort_order: sort_order ? parseInt(sort_order, 10) : 0,
          is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      router.back();
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Güncellenemedi.');
    }
    setLoading(false);
  };

  if (fetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a365d" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Kapı adı *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Örn: Oda 102"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.label}>Tip *</Text>
        <View style={styles.chipRow}>
          {DOOR_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.chip, door_type === t.value && styles.chipActive]}
              onPress={() => setDoorType(t.value as typeof door_type)}
            >
              <Text style={[styles.chipText, door_type === t.value && styles.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {door_type === 'room' && (
          <>
            <Text style={styles.label}>Oda</Text>
            <View style={styles.chipRow}>
              {rooms.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.chip, room_id === r.id && styles.chipActive]}
                  onPress={() => setRoomId(room_id === r.id ? null : r.id)}
                >
                  <Text style={[styles.chipText, room_id === r.id && styles.chipTextActive]}>{r.room_number}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <Text style={styles.label}>Sıra</Text>
        <TextInput
          style={styles.input}
          value={sort_order}
          onChangeText={setSortOrder}
          placeholder="0"
          keyboardType="number-pad"
          placeholderTextColor="#9ca3af"
        />
        <TouchableOpacity style={[styles.toggleRow, !is_active && styles.toggleRowInactive]} onPress={() => setIsActive(!is_active)}>
          <Text style={styles.toggleLabel}>Kapı aktif</Text>
          <View style={[styles.switch, is_active && styles.switchOn]}>
            <Text style={styles.switchText}>{is_active ? 'Açık' : 'Kapalı'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitDisabled]} onPress={submit} disabled={loading}>
          <Text style={styles.submitText}>{loading ? 'Kaydediliyor...' : 'Güncelle'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7fafc' },
  content: { padding: 20, paddingBottom: 48 },
  label: { fontSize: 14, fontWeight: '600', color: '#4a5568', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1a202c',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#1a365d', borderColor: '#1a365d' },
  chipText: { fontSize: 14, color: '#4a5568' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toggleRowInactive: { borderColor: '#cbd5e0', opacity: 0.9 },
  toggleLabel: { fontSize: 16, color: '#1a202c', fontWeight: '500' },
  switch: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#e2e8f0' },
  switchOn: { backgroundColor: '#38a169' },
  switchText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  submitBtn: { marginTop: 28, padding: 16, backgroundColor: '#1a365d', borderRadius: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
