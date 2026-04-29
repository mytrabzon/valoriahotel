import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { theme } from '@/constants/theme';
import { sendBulkToStaff } from '@/lib/notificationService';

type AssignmentRow = {
  id: string;
  plan_id: string;
  staff_note: string | null;
  viewed_at: string | null;
  completed_at: string | null;
};

type PlanRow = {
  id: string;
  target_date: string;
  note: string | null;
  created_at: string;
};

type PlanRoomRow = {
  id: string;
  plan_id: string;
  room_id: string;
  note: string | null;
  is_done: boolean;
  done_at: string | null;
  done_by_staff_id?: string | null;
};

type RoomRow = { id: string; room_number: string };
const DONE_GRACE_MS = 60 * 1000;

export default function StaffCleaningPlanScreen() {
  const router = useRouter();
  const staff = useAuthStore((s) => s.staff);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [plansById, setPlansById] = useState<Record<string, PlanRow>>({});
  const [planRoomsByPlanId, setPlanRoomsByPlanId] = useState<Record<string, PlanRoomRow[]>>({});
  const [roomNumbersById, setRoomNumbersById] = useState<Record<string, string>>({});
  const [notesByAssignmentId, setNotesByAssignmentId] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isConfirmedDone = (room: PlanRoomRow, now: number) => {
    if (!room.is_done || !room.done_at) return false;
    const doneAtMs = new Date(room.done_at).getTime();
    if (Number.isNaN(doneAtMs)) return false;
    return now - doneAtMs >= DONE_GRACE_MS;
  };

  const getGraceRemainingSeconds = (room: PlanRoomRow, now: number) => {
    if (!room.is_done || !room.done_at) return 0;
    const doneAtMs = new Date(room.done_at).getTime();
    if (Number.isNaN(doneAtMs)) return 0;
    return Math.max(0, Math.ceil((DONE_GRACE_MS - (now - doneAtMs)) / 1000));
  };

  async function loadData() {
    if (!staff?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: aData, error: aErr } = await supabase
      .from('room_cleaning_plan_assignments')
      .select('id, plan_id, staff_note, viewed_at, completed_at')
      .eq('staff_id', staff.id)
      .order('id', { ascending: false });
    if (aErr) {
      setLoading(false);
      return;
    }
    const assignmentRows = (aData as AssignmentRow[] | null) ?? [];
    setAssignments(assignmentRows);
    setNotesByAssignmentId(
      Object.fromEntries(assignmentRows.map((a) => [a.id, a.staff_note || '']))
    );

    const planIds = [...new Set(assignmentRows.map((a) => a.plan_id))];
    if (planIds.length === 0) {
      setPlansById({});
      setPlanRoomsByPlanId({});
      setRoomNumbersById({});
      setLoading(false);
      return;
    }

    const [{ data: pData }, { data: prData }] = await Promise.all([
      supabase.from('room_cleaning_plans').select('id, target_date, note, created_at').in('id', planIds),
      supabase
        .from('room_cleaning_plan_rooms')
        .select('id, plan_id, room_id, note, is_done, done_at, done_by_staff_id')
        .in('plan_id', planIds)
        .order('sort_order'),
    ]);
    const plans = (pData as PlanRow[] | null) ?? [];
    const planRooms = (prData as PlanRoomRow[] | null) ?? [];
    const roomIds = [...new Set(planRooms.map((r) => r.room_id))];
    const roomNumberMap: Record<string, string> = {};
    if (roomIds.length > 0) {
      const { data: roomsData } = await supabase.from('rooms').select('id, room_number').in('id', roomIds);
      ((roomsData as RoomRow[] | null) ?? []).forEach((r) => {
        roomNumberMap[r.id] = r.room_number;
      });
    }
    setRoomNumbersById(roomNumberMap);
    setPlansById(Object.fromEntries(plans.map((p) => [p.id, p])));
    const grouped: Record<string, PlanRoomRow[]> = {};
    planRooms.forEach((r) => {
      if (!grouped[r.plan_id]) grouped[r.plan_id] = [];
      grouped[r.plan_id].push(r);
    });
    setPlanRoomsByPlanId(grouped);

    const notViewedIds = assignmentRows.filter((a) => !a.viewed_at).map((a) => a.id);
    if (notViewedIds.length > 0) {
      await supabase.from('room_cleaning_plan_assignments').update({ viewed_at: new Date().toISOString() }).in('id', notViewedIds);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, [staff?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function toggleRoomDone(planRoom: PlanRoomRow) {
    const nextDone = !planRoom.is_done;
    const optimisticDoneAt = nextDone ? new Date().toISOString() : null;
    const optimisticDoneBy = nextDone ? staff?.id ?? null : null;

    // Odada yukleniyor gostermeden aninda isaretle; kalicilik arka planda tamamlanir.
    setPlanRoomsByPlanId((prev) => {
      const list = prev[planRoom.plan_id] ?? [];
      return {
        ...prev,
        [planRoom.plan_id]: list.map((room) =>
          room.id === planRoom.id
            ? { ...room, is_done: nextDone, done_at: optimisticDoneAt, done_by_staff_id: optimisticDoneBy }
            : room
        ),
      };
    });

    const { error } = await supabase
      .from('room_cleaning_plan_rooms')
      .update({
        is_done: nextDone,
        done_at: optimisticDoneAt,
        done_by_staff_id: nextDone ? staff?.id ?? null : null,
      })
      .eq('id', planRoom.id);
    if (error) {
      // Arka plan kaydi basarisizsa gorunumu geri al.
      setPlanRoomsByPlanId((prev) => {
        const list = prev[planRoom.plan_id] ?? [];
        return {
          ...prev,
          [planRoom.plan_id]: list.map((room) =>
            room.id === planRoom.id
              ? { ...room, is_done: planRoom.is_done, done_at: planRoom.done_at, done_by_staff_id: planRoom.done_by_staff_id ?? null }
              : room
          ),
        };
      });
      Alert.alert('Hata', error.message);
      return;
    }
    if (staff?.id) {
      const roomNumber = roomNumbersById[planRoom.room_id] || '?';
      void sendBulkToStaff({
        target: 'all_staff',
        title: nextDone ? 'Oda temizlendi' : 'Temizlik geri alındı',
        body: nextDone
          ? `Oda ${roomNumber} temizlendi olarak işaretlendi.`
          : `Oda ${roomNumber} için temizlendi işareti geri alındı.`,
        createdByStaffId: staff.id,
        notificationType: 'staff_room_cleaning_status',
        category: 'staff',
        data: { url: '/staff/cleaning-plan', planRoomId: planRoom.id, roomId: planRoom.room_id, roomNumber, isDone: nextDone },
      });
    }
    // Arka plan esitlemesi: UI aninda kaldigi icin bekletmeyelim.
    void loadData();
  }

  async function saveAssignmentNote(assignment: AssignmentRow) {
    const nextNote = (notesByAssignmentId[assignment.id] || '').trim();
    setSavingId(assignment.id);
    const { error } = await supabase
      .from('room_cleaning_plan_assignments')
      .update({
        staff_note: nextNote || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', assignment.id);
    setSavingId(null);
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    const plan = plansById[assignment.plan_id];
    const completedCount = (planRoomsByPlanId[assignment.plan_id] ?? []).filter((x) => x.is_done).length;
    const totalCount = (planRoomsByPlanId[assignment.plan_id] ?? []).length;
    if (staff?.id) {
      void sendBulkToStaff({
        target: 'all_staff',
        title: 'Temizlik listesi güncellendi',
        body: `${plan?.target_date || 'Bugün'} planı için not kaydedildi (${completedCount}/${totalCount}).`,
        createdByStaffId: staff.id,
        notificationType: 'staff_room_cleaning_plan_note_saved',
        category: 'staff',
        data: { url: '/staff/cleaning-plan', planId: assignment.plan_id, completedCount, totalCount },
      });
    }
    Alert.alert('Kaydedildi', 'Notunuz kaydedildi.');
    await loadData();
  }

  const sortedAssignments = useMemo(
    () =>
      [...assignments].sort((a, b) => {
        const ad = plansById[a.plan_id]?.target_date || '';
        const bd = plansById[b.plan_id]?.target_date || '';
        return bd.localeCompare(ad);
      }),
    [assignments, plansById]
  );

  const isAssignmentFullyDone = (assignment: AssignmentRow) => {
    const planRooms = planRoomsByPlanId[assignment.plan_id] ?? [];
    if (planRooms.length === 0) return false;
    return planRooms.every((room) => isConfirmedDone(room, nowMs));
  };

  const activeAssignments = sortedAssignments.filter(
    (assignment) => !(isAssignmentFullyDone(assignment) && !!assignment.completed_at)
  );
  const completedAssignments = sortedAssignments.filter(
    (assignment) => isAssignmentFullyDone(assignment) && !!assignment.completed_at
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Temizlik</Text>
        <TouchableOpacity style={styles.historyBtn} activeOpacity={0.85} onPress={() => router.push('/staff/cleaning-history' as never)}>
          <Ionicons name="time-outline" size={16} color="#fff" />
          <Text style={styles.historyBtnText}>Geçmiş Temizlikler</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Sabah bu listeyi kontrol edin, odaları işaretleyin ve notunuzu kaydedin.</Text>

      {activeAssignments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-done-outline" size={38} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Aktif temizlenecek oda listesi yok.</Text>
        </View>
      ) : (
        activeAssignments.map((a) => {
          const plan = plansById[a.plan_id];
          const planRooms = planRoomsByPlanId[a.plan_id] ?? [];
          const completedCount = planRooms.filter((x) => isConfirmedDone(x, nowMs)).length;
          const doneRooms = planRooms.filter((x) => isConfirmedDone(x, nowMs));
          const activeRooms = planRooms.filter((x) => !isConfirmedDone(x, nowMs));
          return (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardTitle}>{plan?.target_date || 'Tarih yok'} planı</Text>
              {!!plan?.note && <Text style={styles.planNote}>Admin notu: {plan.note}</Text>}
              <Text style={styles.progressText}>
                Tamamlanan: {completedCount}/{planRooms.length}
              </Text>

              {activeRooms.map((pr) => (
                <TouchableOpacity key={pr.id} style={[styles.roomRow, pr.is_done && styles.roomRowDone]} onPress={() => void toggleRoomDone(pr)} activeOpacity={0.85}>
                  <Ionicons
                    name={pr.is_done ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={pr.is_done ? theme.colors.success : theme.colors.textMuted}
                  />
                  <Text style={[styles.roomText, pr.is_done && styles.roomTextDone]}>
                    Oda {roomNumbersById[pr.room_id] || '-'}
                  </Text>
                  {pr.is_done && !isConfirmedDone(pr, nowMs) ? (
                    <Text style={styles.pendingDoneText}>{getGraceRemainingSeconds(pr, nowMs)} sn</Text>
                  ) : null}
                  {savingId === pr.id ? <ActivityIndicator size="small" color={theme.colors.primary} /> : null}
                </TouchableOpacity>
              ))}

              {doneRooms.length > 0 ? (
                <View style={styles.doneListWrap}>
                  <Text style={styles.doneListTitle}>Temizlenen odalar ({doneRooms.length})</Text>
                  <Text style={styles.doneListText}>
                    {doneRooms.map((r) => roomNumbersById[r.room_id] || '-').join(', ')}
                  </Text>
                </View>
              ) : null}

              {planRooms.length > 0 && completedCount === planRooms.length ? (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.infoBoxText}>
                    Tum odalar tamamlandi. Listeyi "Temizlenen Odalar" bolumune tasimak icin notu kaydet.
                  </Text>
                </View>
              ) : null}

              <TextInput
                style={styles.noteInput}
                placeholder="Gün sonu notu (opsiyonel)"
                value={notesByAssignmentId[a.id] ?? ''}
                onChangeText={(v) => setNotesByAssignmentId((prev) => ({ ...prev, [a.id]: v }))}
                multiline
              />
              <TouchableOpacity style={styles.saveBtn} onPress={() => void saveAssignmentNote(a)} disabled={savingId === a.id}>
                {savingId === a.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Notu kaydet</Text>}
              </TouchableOpacity>
            </View>
          );
        })
      )}

      <View style={styles.completedSection}>
        <Text style={styles.completedSectionTitle}>Temizlenen Odalar</Text>
        {completedAssignments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="archive-outline" size={34} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Notu kaydedilmis tamamlanmis liste yok.</Text>
          </View>
        ) : (
          completedAssignments.map((a) => {
            const plan = plansById[a.plan_id];
            const planRooms = planRoomsByPlanId[a.plan_id] ?? [];
            const doneRooms = planRooms.filter((x) => isConfirmedDone(x, nowMs));
            return (
              <View key={`completed-${a.id}`} style={styles.completedCard}>
                <Text style={styles.cardTitle}>{plan?.target_date || 'Tarih yok'} plani</Text>
                <Text style={styles.progressText}>Tamamlanan: {doneRooms.length}/{planRooms.length}</Text>
                <View style={styles.doneListWrap}>
                  <Text style={styles.doneListTitle}>Temizlenen odalar ({doneRooms.length})</Text>
                  <Text style={styles.doneListText}>
                    {doneRooms.map((r) => roomNumbersById[r.room_id] || '-').join(', ')}
                  </Text>
                </View>
                <View style={styles.savedNoteWrap}>
                  <Text style={styles.savedNoteTitle}>Kaydedilen not</Text>
                  <Text style={styles.savedNoteText}>{(a.staff_note || '').trim() || 'Not girilmedi.'}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: 16, paddingBottom: 36 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  historyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 14, color: theme.colors.textSecondary },
  emptyCard: {
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyText: { fontSize: 14, color: theme.colors.textMuted },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: 12,
    padding: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  planNote: { marginTop: 4, fontSize: 13, color: theme.colors.textSecondary },
  progressText: { marginTop: 6, marginBottom: 8, fontSize: 12, color: theme.colors.textMuted, fontWeight: '700' },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  roomRowDone: { backgroundColor: '#ecfdf3' },
  roomText: { fontSize: 14, color: theme.colors.text, flex: 1 },
  roomTextDone: { color: theme.colors.success, fontWeight: '700' },
  pendingDoneText: { fontSize: 11, fontWeight: '700', color: theme.colors.warning },
  doneListWrap: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  doneListTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 },
  doneListText: { fontSize: 13, color: theme.colors.text },
  infoBox: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoBoxText: { flex: 1, fontSize: 12, color: '#1e3a8a', fontWeight: '600' },
  noteInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 70,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    paddingVertical: 11,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  completedSection: { marginTop: 14, gap: 10 },
  completedSectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  completedCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 12,
  },
  savedNoteWrap: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  savedNoteTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 },
  savedNoteText: { fontSize: 13, color: theme.colors.text },
});
