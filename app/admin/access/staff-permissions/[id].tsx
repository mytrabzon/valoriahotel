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

type StaffRow = { id: string; full_name: string | null; department: string | null };
type DoorRow = { id: string; name: string };

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const DAY_LABELS: Record<number, string> = { 1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt', 7: 'Paz' };

export default function EditStaffPermissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [staff_id, setStaffId] = useState<string | null>(null);
  const [door_id, setDoorId] = useState<string | null>(null);
  const [time_start, setTimeStart] = useState('');
  const [time_end, setTimeEnd] = useState('');
  const [days_of_week, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [valid_from, setValidFrom] = useState('');
  const [valid_until, setValidUntil] = useState('');
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [doors, setDoors] = useState<DoorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('staff').select('id, full_name, department').eq('is_active', true).order('full_name'),
      supabase.from('doors').select('id, name').eq('is_active', true).order('sort_order').order('name'),
    ]).then(([s, d]) => {
      setStaffList(s.data ?? []);
      setDoors(d.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from('staff_door_permissions').select('*').eq('id', id).single();
      if (error || !data) {
        setFetching(false);
        Alert.alert('Hata', 'Yetki bulunamadı.');
        return;
      }
      setStaffId(data.staff_id);
      setDoorId(data.door_id);
      setTimeStart(data.time_start?.slice(0, 5) ?? '');
      setTimeEnd(data.time_end?.slice(0, 5) ?? '');
      setDaysOfWeek(Array.isArray(data.days_of_week) ? (data.days_of_week as number[]) : [1, 2, 3, 4, 5, 6, 7]);
      setValidFrom(data.valid_from ? new Date(data.valid_from).toISOString().slice(0, 10) : '');
      setValidUntil(data.valid_until ? new Date(data.valid_until).toISOString().slice(0, 10) : '');
      setFetching(false);
    })();
  }, [id]);

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  const submit = async () => {
    if (!staff_id || !door_id) {
      Alert.alert('Hata', 'Personel ve kapı seçin.');
      return;
    }
    if (days_of_week.length === 0) {
      Alert.alert('Hata', 'En az bir gün seçin.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff_door_permissions')
        .update({
          staff_id,
          door_id,
          time_start: time_start.trim() || null,
          time_end: time_end.trim() || null,
          days_of_week,
          valid_from: valid_from || null,
          valid_until: valid_until || null,
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
        <Text style={styles.label}>Personel *</Text>
        <View style={styles.pickerWrap}>
          {staffList.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.pickerItem, staff_id === s.id && styles.pickerItemActive]}
              onPress={() => setStaffId(staff_id === s.id ? null : s.id)}
            >
              <Text style={[styles.pickerItemText, staff_id === s.id && styles.pickerItemTextActive]} numberOfLines={1}>
                {s.full_name ?? '—'} {s.department ? `(${s.department})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Kapı *</Text>
        <View style={styles.pickerWrap}>
          {doors.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.pickerItem, door_id === d.id && styles.pickerItemActive]}
              onPress={() => setDoorId(door_id === d.id ? null : d.id)}
            >
              <Text style={[styles.pickerItemText, door_id === d.id && styles.pickerItemTextActive]}>{d.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Başlangıç saati (HH:mm)</Text>
        <TextInput
          style={styles.input}
          value={time_start}
          onChangeText={setTimeStart}
          placeholder="09:00"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.label}>Bitiş saati (HH:mm)</Text>
        <TextInput
          style={styles.input}
          value={time_end}
          onChangeText={setTimeEnd}
          placeholder="18:00"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.label}>Günler</Text>
        <View style={styles.chipRow}>
          {DAYS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, days_of_week.includes(d) && styles.chipActive]}
              onPress={() => toggleDay(d)}
            >
              <Text style={[styles.chipText, days_of_week.includes(d) && styles.chipTextActive]}>{DAY_LABELS[d]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Geçerlilik başlangıç</Text>
        <TextInput
          style={styles.input}
          value={valid_from}
          onChangeText={setValidFrom}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.label}>Geçerlilik bitiş</Text>
        <TextInput
          style={styles.input}
          value={valid_until}
          onChangeText={setValidUntil}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
        />
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
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerItemActive: { backgroundColor: '#1a365d', borderColor: '#1a365d' },
  pickerItemText: { fontSize: 13, color: '#4a5568' },
  pickerItemTextActive: { color: '#fff', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1a365d', borderColor: '#1a365d' },
  chipText: { fontSize: 14, color: '#4a5568' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { marginTop: 28, padding: 16, backgroundColor: '#1a365d', borderRadius: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
