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
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const CARD_TYPES = [
  { value: 'guest', label: 'Misafir' },
  { value: 'vip_guest', label: 'VIP' },
  { value: 'housekeeping', label: 'Temizlik' },
  { value: 'technical', label: 'Teknik' },
  { value: 'security', label: 'Güvenlik' },
  { value: 'manager', label: 'Yönetici' },
  { value: 'temporary', label: 'Geçici' },
];

type GuestRow = { id: string; full_name: string | null; room_id: string | null };
type StaffRow = { id: string; full_name: string | null; department: string | null };
type DoorRow = { id: string; name: string };

export default function NewCardScreen() {
  const router = useRouter();
  const { staff: currentStaff } = useAuthStore();
  const [serial_number, setSerialNumber] = useState('');
  const [card_type, setCardType] = useState('guest');
  const [linkType, setLinkType] = useState<'guest' | 'staff'>('guest');
  const [guest_id, setGuestId] = useState<string | null>(null);
  const [staff_id, setStaffId] = useState<string | null>(null);
  const [valid_from, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [valid_until, setValidUntil] = useState('');
  const [all_doors, setAllDoors] = useState(false);
  const [doorIds, setDoorIds] = useState<string[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [doors, setDoors] = useState<DoorRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('guests').select('id, full_name, room_id').order('full_name'),
      supabase.from('staff').select('id, full_name, department').eq('is_active', true).order('full_name'),
      supabase.from('doors').select('id, name').eq('is_active', true).order('sort_order').order('name'),
    ]).then(([g, s, d]) => {
      setGuests(g.data ?? []);
      setStaffList(s.data ?? []);
      setDoors(d.data ?? []);
    });
  }, []);

  const toggleDoor = (doorId: string) => {
    setDoorIds((prev) => (prev.includes(doorId) ? prev.filter((id) => id !== doorId) : [...prev, doorId]));
  };

  const submit = async () => {
    const serial = serial_number.trim();
    if (!serial) {
      Alert.alert('Hata', 'Kart seri numarası girin.');
      return;
    }
    if (linkType === 'guest' && !guest_id) {
      Alert.alert('Hata', 'Misafir seçin.');
      return;
    }
    if (linkType === 'staff' && !staff_id) {
      Alert.alert('Hata', 'Personel seçin.');
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
      const { data: card, error: cardError } = await supabase
        .from('access_cards')
        .insert({
          serial_number: serial,
          card_type: card_type as 'guest' | 'vip_guest' | 'housekeeping' | 'technical' | 'security' | 'manager' | 'temporary',
          guest_id: linkType === 'guest' ? guest_id : null,
          staff_id: linkType === 'staff' ? staff_id : null,
          valid_from: validFromDate,
          valid_until: validUntilDate,
          all_doors,
          is_active: true,
          created_by: currentStaff?.id ?? null,
        })
        .select('id')
        .single();
      if (cardError) throw cardError;
      if (!all_doors && doorIds.length > 0 && card?.id) {
        const { error: permError } = await supabase.from('card_door_permissions').insert(doorIds.map((door_id) => ({ card_id: card.id, door_id })));
        if (permError) Alert.alert('Uyarı', 'Kart oluşturuldu ancak kapı yetkileri eklenemedi: ' + permError.message);
      }
      router.replace('/admin/access/cards');
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Kart eklenemedi.');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Kart seri numarası *</Text>
        <TextInput
          style={styles.input}
          value={serial_number}
          onChangeText={setSerialNumber}
          placeholder="Örn: 97-76-67-9 veya RFID değeri"
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
        <Text style={styles.label}>Bağlı kişi</Text>
        <View style={styles.linkRow}>
          <TouchableOpacity style={[styles.linkTab, linkType === 'guest' && styles.linkTabActive]} onPress={() => setLinkType('guest')}>
            <Text style={[styles.linkTabText, linkType === 'guest' && styles.linkTabTextActive]}>Misafir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkTab, linkType === 'staff' && styles.linkTabActive]} onPress={() => setLinkType('staff')}>
            <Text style={[styles.linkTabText, linkType === 'staff' && styles.linkTabTextActive]}>Personel</Text>
          </TouchableOpacity>
        </View>
        {linkType === 'guest' && (
          <View style={styles.pickerWrap}>
            {guests.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.pickerItem, guest_id === g.id && styles.pickerItemActive]}
                onPress={() => setGuestId(guest_id === g.id ? null : g.id)}
              >
                <Text style={[styles.pickerItemText, guest_id === g.id && styles.pickerItemTextActive]} numberOfLines={1}>
                  {g.full_name ?? 'İsimsiz'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {linkType === 'staff' && (
          <View style={styles.pickerWrap}>
            {staffList.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.pickerItem, staff_id === s.id && styles.pickerItemActive]}
                onPress={() => setStaffId(staff_id === s.id ? null : s.id)}
              >
                <Text style={[styles.pickerItemText, staff_id === s.id && styles.pickerItemTextActive]} numberOfLines={1}>
                  {s.full_name ?? 'İsimsiz'} {s.department ? `(${s.department})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={styles.label}>Geçerlilik başlangıç *</Text>
        <TextInput
          style={styles.input}
          value={valid_from}
          onChangeText={setValidFrom}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.label}>Geçerlilik bitiş (boş = süresiz)</Text>
        <TextInput
          style={styles.input}
          value={valid_until}
          onChangeText={setValidUntil}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9ca3af"
        />
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
          <Text style={styles.submitText}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#1a365d', borderColor: '#1a365d' },
  chipText: { fontSize: 13, color: '#4a5568' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  linkRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  linkTab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#e2e8f0' },
  linkTabActive: { backgroundColor: '#1a365d' },
  linkTabText: { fontSize: 14, color: '#4a5568' },
  linkTabTextActive: { color: '#fff', fontWeight: '600' },
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
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  switchLabel: { fontSize: 15, color: '#1a202c' },
  submitBtn: { marginTop: 28, padding: 16, backgroundColor: '#1a365d', borderRadius: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
