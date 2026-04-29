import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { adminTheme } from '@/constants/adminTheme';
import { useTranslation } from 'react-i18next';
import { sendNotification } from '@/lib/notificationService';
import { useAuthStore } from '@/stores/authStore';

type AttendanceRow = {
  work_date: string;
  staff_id: string;
  full_name: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  late_minutes: number | null;
  total_hours: number | null;
  day_status: 'zamaninda' | 'gec_geldi' | 'devamsiz' | 'erken_cikti' | 'eksik_kayit';
};

export default function AdminAttendanceIndexScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const staff = useAuthStore((s) => s.staff);
  const [qText, setQText] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'on_time' | 'late' | 'no_check_in'>('all');
  const [manualNote, setManualNote] = useState('');
  const [sendingNoCheckIn, setSendingNoCheckIn] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const isTr = i18n.language?.toLowerCase().startsWith('tr');
  const localeCode = isTr ? 'tr-TR' : 'en-US';
  const monthStart = `${today.slice(0, 8)}01`;

  const dailyQuery = useQuery({
    queryKey: ['admin-attendance', 'day', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_attendance_daily_report')
        .select('*')
        .eq('work_date', today)
        .order('full_name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as AttendanceRow[];
    },
  });

  const monthlyQuery = useQuery({
    queryKey: ['admin-attendance', 'month', monthStart, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_attendance_daily_report')
        .select('work_date, staff_id, full_name, day_status, late_minutes, check_in_at')
        .gte('work_date', monthStart)
        .lte('work_date', today);
      if (error) throw new Error(error.message);
      return (data ?? []) as AttendanceRow[];
    },
  });

  const rows = useMemo(() => {
    const txt = qText.trim().toLocaleLowerCase('tr-TR');
    const base = dailyQuery.data ?? [];
    const filteredByStatus = base.filter((r) => {
      if (activeFilter === 'on_time') return r.day_status === 'zamaninda';
      if (activeFilter === 'late') return r.day_status === 'gec_geldi';
      if (activeFilter === 'no_check_in') return !r.check_in_at;
      return true;
    });
    if (!txt) return filteredByStatus;
    return filteredByStatus.filter((r) => (r.full_name ?? '').toLocaleLowerCase('tr-TR').includes(txt));
  }, [activeFilter, dailyQuery.data, qText]);

  const dailyStats = useMemo(() => {
    const data = dailyQuery.data ?? [];
    const total = data.length;
    const onTime = data.filter((r) => r.day_status === 'zamaninda').length;
    const late = data.filter((r) => r.day_status === 'gec_geldi').length;
    const noCheckIn = data.filter((r) => !r.check_in_at).length;
    return { total, onTime, late, noCheckIn };
  }, [dailyQuery.data]);

  const monthlyRanking = useMemo(() => {
    const grouped = new Map<
      string,
      {
        staffId: string;
        fullName: string;
        totalDays: number;
        checkInDays: number;
        onTimeDays: number;
        lateDays: number;
        totalLateMinutes: number;
      }
    >();

    for (const row of monthlyQuery.data ?? []) {
      const key = row.staff_id;
      const current = grouped.get(key) ?? {
        staffId: row.staff_id,
        fullName: row.full_name ?? '-',
        totalDays: 0,
        checkInDays: 0,
        onTimeDays: 0,
        lateDays: 0,
        totalLateMinutes: 0,
      };
      current.totalDays += 1;
      if (row.check_in_at) {
        current.checkInDays += 1;
      }
      if (row.day_status === 'zamaninda') current.onTimeDays += 1;
      if (row.day_status === 'gec_geldi') {
        current.lateDays += 1;
        current.totalLateMinutes += row.late_minutes ?? 0;
      }
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map((item) => {
        const punctualityRate = item.totalDays > 0 ? (item.onTimeDays / item.totalDays) * 100 : 0;
        const avgLateMinutes = item.lateDays > 0 ? item.totalLateMinutes / item.lateDays : 0;
        return { ...item, punctualityRate, avgLateMinutes };
      })
      .sort((a, b) => {
        if (b.punctualityRate !== a.punctualityRate) return b.punctualityRate - a.punctualityRate;
        if (a.avgLateMinutes !== b.avgLateMinutes) return a.avgLateMinutes - b.avgLateMinutes;
        return b.checkInDays - a.checkInDays;
      });
  }, [monthlyQuery.data]);

  const statusLabel = (status: AttendanceRow['day_status']) => {
    const labels: Record<AttendanceRow['day_status'], string> = isTr
      ? {
          zamaninda: 'Zamanında',
          gec_geldi: 'Geç geldi',
          devamsiz: 'Devamsız',
          erken_cikti: 'Erken çıktı',
          eksik_kayit: 'Eksik kayıt',
        }
      : {
          zamaninda: 'On time',
          gec_geldi: 'Late check-in',
          devamsiz: 'Absent',
          erken_cikti: 'Early check-out',
          eksik_kayit: 'Missing record',
        };
    return labels[status];
  };

  const refreshAll = async () => {
    await Promise.all([dailyQuery.refetch(), monthlyQuery.refetch()]);
  };

  const noCheckInRows = useMemo(() => (dailyQuery.data ?? []).filter((r) => !r.check_in_at), [dailyQuery.data]);

  const sendNoCheckInNotification = async () => {
    if (noCheckInRows.length === 0) {
      Alert.alert(isTr ? 'Bilgi' : 'Info', isTr ? 'Bugün giriş yapmayan personel yok.' : 'No staff without check-in today.');
      return;
    }
    if (!staff?.id) {
      Alert.alert(isTr ? 'Hata' : 'Error', isTr ? 'Oturum bilgisi bulunamadı.' : 'Session information is missing.');
      return;
    }
    try {
      setSendingNoCheckIn(true);
      const bodyText =
        manualNote.trim() ||
        (isTr ? 'Bugün neden giriş yapmadınız? Lütfen bilgi notu bırakın.' : 'Why did you not check in today? Please leave an information note.');
      const titleText = isTr ? 'Mesai Giriş Hatırlatması' : 'Attendance Check-in Reminder';

      const results = await Promise.all(
        noCheckInRows.map((row) =>
          sendNotification({
            staffId: row.staff_id,
            title: titleText,
            body: bodyText,
            notificationType: 'attendance_missing_checkin',
            category: 'staff',
            createdByStaffId: staff.id,
            data: { screen: 'staff/attendance/index', date: today },
          })
        )
      );
      const failedCount = results.filter((r) => !!r.error).length;
      const okCount = results.length - failedCount;
      Alert.alert(
        isTr ? 'Bildirim gönderildi' : 'Notification sent',
        isTr
          ? `${okCount} personele gönderildi${failedCount > 0 ? `, ${failedCount} kişide hata var.` : '.'}`
          : `Sent to ${okCount} staff${failedCount > 0 ? `, ${failedCount} failed.` : '.'}`
      );
    } catch (error) {
      Alert.alert(isTr ? 'Hata' : 'Error', error instanceof Error ? error.message : isTr ? 'Bilinmeyen hata' : 'Unknown error');
    } finally {
      setSendingNoCheckIn(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={dailyQuery.isFetching || monthlyQuery.isFetching}
          onRefresh={refreshAll}
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{isTr ? 'Mesai Takibi' : 'Attendance Tracking'}</Text>
          <Text style={styles.subtitle}>{isTr ? 'Aylık giriş performansı ve günlük detaylar' : 'Monthly check-in performance and daily details'}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refreshAll} disabled={dailyQuery.isFetching || monthlyQuery.isFetching}>
          <Text style={styles.refreshText}>{isTr ? 'Yenile' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity style={[styles.statCard, activeFilter === 'all' && styles.statCardActive]} onPress={() => setActiveFilter('all')}>
          <Text style={styles.statValue}>{dailyStats.total}</Text>
          <Text style={styles.statLabel}>{isTr ? 'Personel' : 'Staff'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, activeFilter === 'on_time' && styles.statCardActive]} onPress={() => setActiveFilter('on_time')}>
          <Text style={styles.statValue}>{dailyStats.onTime}</Text>
          <Text style={styles.statLabel}>{isTr ? 'Zamanında giriş' : 'On-time check-ins'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, activeFilter === 'late' && styles.statCardActive]} onPress={() => setActiveFilter('late')}>
          <Text style={styles.statValue}>{dailyStats.late}</Text>
          <Text style={styles.statLabel}>{isTr ? 'Geç giriş' : 'Late check-ins'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, activeFilter === 'no_check_in' && styles.statCardActive]} onPress={() => setActiveFilter('no_check_in')}>
          <Text style={styles.statValue}>{dailyStats.noCheckIn}</Text>
          <Text style={styles.statLabel}>{isTr ? 'Giriş yok (tıkla)' : 'No check-in (tap)'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.notifyCard}>
        <Text style={styles.notifyTitle}>{isTr ? 'Giriş yapmayanlara manuel bildirim' : 'Manual notification to no check-ins'}</Text>
        <TextInput
          value={manualNote}
          onChangeText={setManualNote}
          multiline
          placeholder={
            isTr
              ? 'Neden giriş yapmadın? gibi not yazabilir veya özel bir mesaj girebilirsiniz.'
              : 'You can write a custom note such as "Why did you not check in?"'
          }
          placeholderTextColor={adminTheme.colors.textSecondary}
          style={styles.noteInput}
        />
        <TouchableOpacity style={[styles.notifyBtn, sendingNoCheckIn && styles.notifyBtnDisabled]} onPress={sendNoCheckInNotification} disabled={sendingNoCheckIn}>
          <Text style={styles.notifyBtnText}>
            {sendingNoCheckIn
              ? isTr
                ? 'Gönderiliyor...'
                : 'Sending...'
              : isTr
                ? `Giriş yapmayanlara gönder (${noCheckInRows.length})`
                : `Send to no check-ins (${noCheckInRows.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        value={qText}
        onChangeText={setQText}
        placeholder={isTr ? 'Personel ara...' : 'Search staff...'}
        placeholderTextColor={adminTheme.colors.textSecondary}
        style={styles.search}
      />

      <Text style={styles.sectionTitle}>{isTr ? 'Aylık giriş sıralaması (en iyi → kötü)' : 'Monthly check-in ranking (best → worst)'}</Text>
      <View style={styles.rankingCard}>
        {monthlyRanking.slice(0, 10).map((item, idx) => (
          <TouchableOpacity
            key={item.staffId}
            style={styles.rankingRow}
            onPress={() => router.push({ pathname: '/admin/attendance/[staffId]', params: { staffId: item.staffId } })}
          >
            <Text style={styles.rankNo}>#{idx + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rankName}>{item.fullName}</Text>
              <Text style={styles.rankMeta}>
                {isTr ? 'Zamanında giriş oranı' : 'On-time rate'}: %{item.punctualityRate.toFixed(0)} · {isTr ? 'Ortalama geç kalma' : 'Avg late'}:{' '}
                {item.avgLateMinutes.toFixed(0)} {isTr ? 'dk' : 'min'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>
        {isTr ? 'Bugün detay listesi' : 'Today detail list'} ({new Date(`${today}T00:00:00`).toLocaleDateString(localeCode)})
      </Text>
      {(rows ?? []).map((row) => (
        <TouchableOpacity
          key={`${row.staff_id}-${row.work_date}`}
          style={styles.card}
          onPress={() => router.push({ pathname: '/admin/attendance/[staffId]', params: { staffId: row.staff_id } })}
        >
          <View style={styles.cardTopRow}>
            <Text style={styles.name}>{row.full_name ?? '-'}</Text>
            <Text style={[styles.statusBadge, row.day_status === 'zamaninda' ? styles.statusGood : styles.statusWarn]}>{statusLabel(row.day_status)}</Text>
          </View>
          <View style={styles.timeRow}>
            <View style={[styles.timeBox, styles.timeIn]}>
              <Text style={styles.timeLabel}>{isTr ? 'Giriş' : 'Check-in'}</Text>
              <Text style={styles.timeValue}>
                {row.check_in_at ? new Date(row.check_in_at).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </Text>
            </View>
            <View style={[styles.timeBox, styles.timeOut]}>
              <Text style={styles.timeLabel}>{isTr ? 'Çıkış' : 'Check-out'}</Text>
              <Text style={styles.timeValue}>
                {row.check_out_at ? new Date(row.check_out_at).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{isTr ? 'Geç kalma' : 'Late by'}: {row.late_minutes ?? 0} {isTr ? 'dk' : 'min'}</Text>
            <Text style={styles.meta}>{isTr ? 'Toplam süre' : 'Total'}: {row.total_hours ? row.total_hours.toFixed(2) : '-'} {isTr ? 'saat' : 'h'}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {!dailyQuery.isFetching && rows.length === 0 ? <Text style={styles.empty}>{isTr ? 'Kayıt bulunamadı' : 'No records found'}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  content: { padding: 16, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: adminTheme.colors.text },
  subtitle: { fontSize: 13, color: adminTheme.colors.textSecondary, marginBottom: 6 },
  sectionTitle: { marginTop: 4, fontSize: 14, fontWeight: '800', color: adminTheme.colors.text },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statCard: {
    minWidth: '23%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    padding: 10,
  },
  statCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  statValue: { fontSize: 18, fontWeight: '800', color: adminTheme.colors.text },
  statLabel: { fontSize: 12, color: adminTheme.colors.textSecondary, marginTop: 2 },
  refreshBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshText: { fontSize: 12, fontWeight: '700', color: adminTheme.colors.text },
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: adminTheme.colors.text,
  },
  notifyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    padding: 12,
    gap: 8,
  },
  notifyTitle: { fontSize: 14, fontWeight: '800', color: adminTheme.colors.text },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: adminTheme.colors.text,
    fontSize: 13,
  },
  notifyBtn: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingVertical: 11,
    alignItems: 'center',
  },
  notifyBtnDisabled: { opacity: 0.6 },
  notifyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  rankingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    overflow: 'hidden',
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f3',
  },
  rankNo: { width: 34, fontSize: 14, fontWeight: '900', color: '#0f766e' },
  rankName: { fontSize: 14, fontWeight: '800', color: adminTheme.colors.text },
  rankMeta: { fontSize: 12, color: adminTheme.colors.textSecondary, marginTop: 1 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe8ff',
    padding: 12,
    gap: 8,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', color: adminTheme.colors.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  statusGood: { backgroundColor: '#dcfce7', color: '#166534' },
  statusWarn: { backgroundColor: '#fff7ed', color: '#9a3412' },
  timeRow: { flexDirection: 'row', gap: 8 },
  timeBox: { flex: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1 },
  timeIn: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  timeOut: { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' },
  timeLabel: { fontSize: 11, fontWeight: '700', color: '#334155' },
  timeValue: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: adminTheme.colors.textSecondary, fontSize: 13 },
  empty: { color: adminTheme.colors.textSecondary, marginTop: 8 },
});
