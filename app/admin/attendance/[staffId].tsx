import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { adminTheme } from '@/constants/adminTheme';

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

export default function AdminAttendanceStaffDetailScreen() {
  const { staffId } = useLocalSearchParams<{ staffId: string }>();
  const { i18n } = useTranslation();
  const isTr = i18n.language?.toLowerCase().startsWith('tr');
  const localeCode = isTr ? 'tr-TR' : 'en-US';
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  const query = useQuery({
    queryKey: ['admin-attendance', 'detail', staffId, monthStart, today],
    enabled: typeof staffId === 'string' && staffId.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_attendance_daily_report')
        .select('*')
        .eq('staff_id', staffId)
        .gte('work_date', monthStart)
        .lte('work_date', today)
        .order('work_date', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as AttendanceRow[];
    },
  });

  const summary = useMemo(() => {
    const rows = query.data ?? [];
    const first = rows[0];
    const totalDays = rows.length;
    const onTime = rows.filter((r) => r.day_status === 'zamaninda').length;
    const lateDays = rows.filter((r) => r.day_status === 'gec_geldi').length;
    const checkInDays = rows.filter((r) => !!r.check_in_at).length;
    const avgLate = lateDays > 0 ? rows.filter((r) => r.day_status === 'gec_geldi').reduce((acc, r) => acc + (r.late_minutes ?? 0), 0) / lateDays : 0;
    const punctualityRate = totalDays > 0 ? (onTime / totalDays) * 100 : 0;
    return {
      fullName: first?.full_name ?? '-',
      totalDays,
      onTime,
      lateDays,
      checkInDays,
      avgLate,
      punctualityRate,
    };
  }, [query.data]);

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

  const statusStyle = (status: AttendanceRow['day_status']) => {
    if (status === 'zamaninda') return { bg: '#ecfdf3', color: '#166534', icon: 'checkmark-circle-outline' as const };
    if (status === 'gec_geldi') return { bg: '#fff7ed', color: '#c2410c', icon: 'time-outline' as const };
    if (status === 'devamsiz') return { bg: '#fef2f2', color: '#b91c1c', icon: 'close-circle-outline' as const };
    if (status === 'erken_cikti') return { bg: '#eff6ff', color: '#1d4ed8', icon: 'exit-outline' as const };
    return { bg: '#f3f4f6', color: '#374151', icon: 'alert-circle-outline' as const };
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />}
    >
      <Text style={styles.title}>{summary.fullName}</Text>
      <Text style={styles.subtitle}>
        {isTr ? 'Aylık giriş performans özeti' : 'Monthly check-in performance summary'}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>%{summary.punctualityRate.toFixed(0)}</Text>
          <Text style={styles.statLabel}>{isTr ? 'Zamanında giriş oranı' : 'On-time rate'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{summary.checkInDays}</Text>
          <Text style={styles.statLabel}>{isTr ? 'Giriş yapılan gün' : 'Check-in days'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{summary.lateDays}</Text>
          <Text style={styles.statLabel}>{isTr ? 'Geç kalınan gün' : 'Late days'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{summary.avgLate.toFixed(0)}</Text>
          <Text style={styles.statLabel}>{isTr ? 'Ort. geç kalma (dk)' : 'Avg late (min)'}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{isTr ? 'Geçmiş gün listesi' : 'Past days list'}</Text>
      {(query.data ?? []).map((row) => (
        <View key={`${row.staff_id}-${row.work_date}`} style={styles.card}>
          {(() => {
            const status = statusStyle(row.day_status);
            return (
              <>
                <View style={styles.cardHead}>
                  <View style={styles.datePill}>
                    <Ionicons name="calendar-clear-outline" size={14} color="#2563eb" />
                    <Text style={styles.dateText}>
                      {new Date(`${row.work_date}T00:00:00`).toLocaleDateString(localeCode, {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Ionicons name={status.icon} size={13} color={status.color} />
                    <Text style={[styles.statusBadgeText, { color: status.color }]}>{statusLabel(row.day_status)}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="log-in-outline" size={14} color="#16a34a" />
                    <Text style={styles.meta}>
                      {isTr ? 'Giriş' : 'Check-in'}:{' '}
                      {row.check_in_at
                        ? new Date(row.check_in_at).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="log-out-outline" size={14} color="#f59e0b" />
                    <Text style={styles.meta}>
                      {isTr ? 'Çıkış' : 'Check-out'}:{' '}
                      {row.check_out_at
                        ? new Date(row.check_out_at).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </Text>
                  </View>
                </View>

                <View style={styles.lateRow}>
                  <Ionicons name="time-outline" size={14} color="#7c3aed" />
                  <Text style={styles.meta}>
                    {isTr ? 'Geç kalma' : 'Late by'}: {row.late_minutes ?? 0} {isTr ? 'dk' : 'min'}
                  </Text>
                </View>
              </>
            );
          })()}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: '900', color: adminTheme.colors.text },
  subtitle: { fontSize: 13, color: adminTheme.colors.textSecondary, marginBottom: 6 },
  sectionTitle: { marginTop: 6, fontSize: 14, fontWeight: '800', color: adminTheme.colors.text },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    minWidth: '23%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    padding: 10,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: adminTheme.colors.text },
  statLabel: { marginTop: 2, fontSize: 12, color: adminTheme.colors.textSecondary },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    padding: 13,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: adminTheme.colors.surfaceSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: { fontSize: 14, fontWeight: '800', color: adminTheme.colors.text },
  meta: { fontSize: 13, color: adminTheme.colors.textSecondary },
});
