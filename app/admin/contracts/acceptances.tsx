import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { adminTheme } from '@/constants/adminTheme';

type StaffRow = { id: string; full_name: string | null; department: string | null };

type Row = {
  id: string;
  token: string;
  room_id: string | null;
  contract_lang: string;
  accepted_at: string;
  assigned_staff_id: string | null;
  assigned_at: string | null;
  room_number?: string | null;
  assigned_staff_name?: string | null;
};

export default function ContractAcceptances() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Row | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: list, error } = await supabase
      .from('contract_acceptances')
      .select('id, token, room_id, contract_lang, accepted_at, assigned_staff_id, assigned_at')
      .order('accepted_at', { ascending: false })
      .limit(200);

    if (error) {
      setRows([]);
      setLoadError(error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoadError(null);

    const roomIds = (list ?? []).map((r) => r.room_id).filter(Boolean) as string[];
    const staffIds = (list ?? []).map((r) => r.assigned_staff_id).filter(Boolean) as string[];

    let roomNumbers: Record<string, string> = {};
    let staffNames: Record<string, string> = {};

    if (roomIds.length > 0) {
      const { data: rooms } = await supabase.from('rooms').select('id, room_number').in('id', roomIds);
      roomNumbers = (rooms ?? []).reduce((acc, r) => ({ ...acc, [r.id]: r.room_number }), {} as Record<string, string>);
    }
    if (staffIds.length > 0) {
      const { data: staff } = await supabase.from('staff').select('id, full_name').in('id', staffIds);
      staffNames = (staff ?? []).reduce((acc, s) => ({ ...acc, [s.id]: s.full_name ?? '—' }), {} as Record<string, string>);
    }

    setRows(
      (list ?? []).map((r) => ({
        ...r,
        room_number: r.room_id ? roomNumbers[r.room_id] ?? '—' : null,
        assigned_staff_name: r.assigned_staff_id ? staffNames[r.assigned_staff_id] ?? '—' : null,
      }))
    );
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (assignModalVisible) {
      supabase
        .from('staff')
        .select('id, full_name, department')
        .eq('is_active', true)
        .order('full_name')
        .then(({ data }) => setStaffList(data ?? []));
    }
  }, [assignModalVisible]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openAssignModal = (item: Row) => {
    setAssignTarget(item);
    setAssignModalVisible(true);
  };

  const assignStaff = async (staffId: string) => {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('contract_acceptances')
        .update({ assigned_staff_id: staffId, assigned_at: new Date().toISOString() })
        .eq('id', assignTarget.id);
      if (error) throw error;
      setAssignModalVisible(false);
      setAssignTarget(null);
      await load();
    } catch (e) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Çalışan atanamadı.');
    }
    setAssigning(false);
  };

  const clearAssignment = async () => {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('contract_acceptances')
        .update({ assigned_staff_id: null, assigned_at: null })
        .eq('id', assignTarget.id);
      if (error) throw error;
      setAssignModalVisible(false);
      setAssignTarget(null);
      await load();
    } catch (e) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Atama kaldırılamadı.');
    }
    setAssigning(false);
  };

  if (loading) return <Text style={styles.loading}>Yükleniyor...</Text>;

  return (
    <View style={styles.container}>
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Liste yüklenemedi: {loadError}</Text>
          <Text style={styles.errorBannerSub}>Admin yetkisi ve RLS (contract_acceptances) kontrol edin.</Text>
        </View>
      ) : null}
      <Text style={styles.hint}>
        Sözleşme onayı yapan misafirler. Çalışan atayın; atanan çalışan uygulama üzerinden oda ataması yapar. İsterseniz siz de misafir/oda işlemlerine gidebilirsiniz.
      </Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[adminTheme.colors.primary]} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.room}>Oda: {item.room_number ?? '—'}</Text>
              <Text style={styles.date}>{new Date(item.accepted_at).toLocaleString('tr-TR')}</Text>
            </View>
            {item.assigned_staff_name ? (
              <View style={styles.assignedRow}>
                <Ionicons name="person" size={14} color={adminTheme.colors.primary} />
                <Text style={styles.assignedText}>Atanan: {item.assigned_staff_name}</Text>
              </View>
            ) : (
              <Text style={styles.unassignedText}>Çalışan atanmadı</Text>
            )}
            <Text style={styles.meta}>Dil: {item.contract_lang.toUpperCase()} · Token: {item.token.slice(0, 8)}…</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.assignStaffBtn} onPress={() => openAssignModal(item)}>
                <Text style={styles.assignStaffBtnText}>{item.assigned_staff_id ? 'Çalışan değiştir' : 'Çalışan ata'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.guestBtn}
                onPress={() => {
                  if (item.room_id) router.push({ pathname: '/admin/guests/index', params: { roomId: item.room_id, fromAcceptance: item.id } });
                  else router.push('/admin/guests/index');
                }}
              >
                <Text style={styles.guestBtnText}>Misafir / Oda</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={assignModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => !assigning && setAssignModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Çalışan ata</Text>
            {assignTarget && (
              <Text style={styles.modalSub}>Sözleşme onayı: {assignTarget.token.slice(0, 12)}… · {new Date(assignTarget.accepted_at).toLocaleString('tr-TR')}</Text>
            )}
            <TouchableOpacity style={styles.clearAssignBtn} onPress={() => clearAssignment()} disabled={assigning}>
              <Text style={styles.clearAssignText}>Atamayı kaldır</Text>
            </TouchableOpacity>
            <FlatList
              data={staffList}
              keyExtractor={(s) => s.id}
              style={styles.staffList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.staffItem}
                  onPress={() => assignStaff(item.id)}
                  disabled={assigning}
                >
                  <Text style={styles.staffName}>{item.full_name ?? item.id.slice(0, 8)}</Text>
                  {item.department ? <Text style={styles.staffDept}>{item.department}</Text> : null}
                </TouchableOpacity>
              )}
            />
            {assigning && <ActivityIndicator style={styles.modalSpinner} size="small" color={adminTheme.colors.primary} />}
            <TouchableOpacity style={styles.modalClose} onPress={() => !assigning && setAssignModalVisible(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  hint: {
    padding: 12,
    paddingHorizontal: 16,
    fontSize: 12,
    color: '#64748b',
    backgroundColor: '#f0f9ff',
  },
  loading: { padding: 24, fontSize: 14, color: '#64748b' },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  room: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  date: { fontSize: 12, color: '#64748b' },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  assignedText: { fontSize: 13, color: '#0369a1', fontWeight: '600' },
  unassignedText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 4 },
  meta: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  assignStaffBtn: {
    flex: 1,
    backgroundColor: '#0369a1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  assignStaffBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  guestBtn: {
    flex: 1,
    backgroundColor: '#1a365d',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  guestBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '80%',
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  clearAssignBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, marginBottom: 12 },
  clearAssignText: { fontSize: 13, color: '#dc2626' },
  staffList: { maxHeight: 280 },
  staffItem: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  staffName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  staffDept: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalSpinner: { marginVertical: 8 },
  modalClose: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  errorBanner: { backgroundColor: '#fef2f2', padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca' },
  errorBannerText: { fontSize: 14, color: '#b91c1c', fontWeight: '600' },
  errorBannerSub: { fontSize: 12, color: '#991b1b', marginTop: 4 },
});
