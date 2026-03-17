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
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const CARD_TYPES = [
  { value: 'guest', label: 'Misafir' },
  { value: 'vip_guest', label: 'VIP' },
  { value: 'housekeeping', label: 'Temizlik' },
  { value: 'technical', label: 'Teknik' },
  { value: 'security', label: 'Güvenlik' },
  { value: 'manager', label: 'Yönetici' },
  { value: 'temporary', label: 'Geçici' },
];

type DoorRow = { id: string; name: string };

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [serial_number, setSerialNumber] = useState('');
  const [card_type, setCardType] = useState('guest');
  const [valid_from, setValidFrom] = useState('');
  const [valid_until, setValidUntil] = useState('');
  const [all_doors, setAllDoors] = useState(false);
  const [is_active, setIsActive] = useState(true);
  const [doorIds, setDoorIds] = useState<string[]>([]);
  const [doors, setDoors] = useState<DoorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    supabase.from('doors').select('id, name').eq('is_active', true).order('sort_order').order('name').then(({ data }) => setDoors(data ?? []));
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: card, error } = await supabase.from('access_cards').select('*').eq('id', id).single();
      if (error || !card) {
        setFetching(false);
        Alert.alert('Hata', 'Kart bulunamadı.');
        return;
      }
      setSerialNumber(card.serial_number ?? '');
      setCardType(card.card_type ?? 'guest');
      setValidFrom(card.valid_from ? new Date(card.valid_from).toISOString().slice(0, 10) : '');
      setValidUntil(card.valid_until ? new Date(card.valid_until).toISOString().slice(0, 10) : '');
      setAllDoors(card.all_doors ?? false);
      setIsActive(card.is_active ?? true);
      if (!card.all_doors) {
        const { data: perms } = await supabase.from('card_door_permissions').select('door_id').eq('card_id', id);
        setDoorIds((perms ?? []).map((p) => p.door_id));
      }
      setFetching(false);
    })();
  }, [id]);

  const toggleDoor = (doorId: string) => {
    setDoorIds((prev) => (prev.includes(doorId) ? prev.filter((id) => id !== doorId) : [...prev, doorId]));
  };

  const submit = async () => {
    const serial = serial_number.trim();
    if (!serial) {
      Alert.alert('Hata', 'Kart seri numarası girin.');
      return;
    }
    if (!all_doors && doorIds.length === 0) {
      Alert.alert('Hata', 'En az bir kapı seçin veya "Tüm kapılar"ı açın.');
      return;
    }
    setLoading(true);
    try {
      const validFromDate = valid_from ? new Date(valid_from).toISOString() : new Date().toISOString();
      const validUntilDate = valid_until ? new Date(valid_until).toISOString() : null;
      const { error: cardError } = await supabase
        .from('access_cards')
        .update({
          serial_number: serial,
          card_type: card_type as 'guest' | 'vip_guest' | 'housekeeping' | 'technical' | 'security' | 'manager' | 'temporary',
          valid_from: validFromDate,
          valid_until: validUntilDate,
          all_doors,
          is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (cardError) throw cardError;
      await supabase.from('card_door_permissions').delete().eq('card_id', id!);
      if (!all_doors && doorIds.length > 0) {
        await supabase.from('card_door_permissions').insert(doorIds.map((door_id) => ({ card_id: id!, door_id })));
      }
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
        <Text style={styles.label}>Kart seri numarası *</Text>
        <TextInput
          style={styles.input}
          value={serial_number}
          onChangeText={setSerialNumber}
          placeholder="Seri no"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.label}>Kart tipi</Text>
        <View style={styles.chipRow}>
          {CARD_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.chip, card_type === t.value && styles.chipActive]}
              onPress={() => setCardType(t.value)}
            >
              <Text style={[styles.chipText, card_type === t.value && styles.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Geçerlilik başlangıç *</Text>
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
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Kart aktif</Text>
          <Switch value={is_active} onValueChange={setIsActive} trackColor={{ false: '#cbd5e0', true: '#1a365d' }} thumbColor="#fff" />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Tüm kapılar</Text>
          <Switch value={all_doors} onValueChange={setAllDoors} trackColor={{ false: '#cbd5e0', true: '#1a365d' }} thumbColor="#fff" />
        </View>
        {!all_doors && (
          <>
            <Text style={styles.label}>Açılabilecek kapılar *</Text>
            <View style={styles.pickerWrap}>
              {doors.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.pickerItem, doorIds.includes(d.id) && styles.pickerItemActive]}
                  onPress={() => toggleDoor(d.id)}
                >
                  <Text style={[styles.pickerItemText, doorIds.includes(d.id) && styles.pickerItemTextActive]}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
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
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1a365d', borderColor: '#1a365d' },
  chipText: { fontSize: 13, color: '#4a5568' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  switchLabel: { fontSize: 15, color: '#1a202c' },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  pickerItemActive: { backgroundColor: '#1a365d', borderColor: '#1a365d' },
  pickerItemText: { fontSize: 13, color: '#4a5568' },
  pickerItemTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { marginTop: 28, padding: 16, backgroundColor: '#1a365d', borderRadius: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
