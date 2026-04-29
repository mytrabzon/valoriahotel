import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { theme } from '@/constants/theme';
import { useTranslation } from 'react-i18next';
import { notifyAdmins } from '@/lib/notificationService';
import { useAuthStore } from '@/stores/authStore';
import {
  addStaffAttendanceEvent,
  checkInStaffAttendance,
  checkOutStaffAttendance,
  getMyAttendanceToday,
  type AttendanceEvent,
} from '@/lib/staffAttendance';

const OFFLINE_QUEUE_KEY = 'staff_attendance_offline_queue_v1';

type OfflineQueuedAction =
  | { type: 'check_in'; payload: Record<string, unknown> }
  | { type: 'check_out'; payload: Record<string, unknown> }
  | { type: 'event'; eventType: 'late_notice' | 'manual_request'; note?: string };

export default function StaffAttendanceScreen() {
  const { i18n } = useTranslation();
  const staff = useAuthStore((s) => s.staff);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ['staff-attendance', 'today'],
    queryFn: getMyAttendanceToday,
  });
  const isTr = i18n.language?.toLowerCase().startsWith('tr');
  const localeCode = isTr ? 'tr-TR' : 'en-US';

  const report = q.data?.report ?? {};
  const dayStatus = report.day_status ?? 'eksik_kayit';

  const statusLabel = useMemo(() => {
    switch (dayStatus) {
      case 'zamaninda':
        return isTr ? 'Zamanında' : 'On time';
      case 'gec_geldi':
        return isTr ? 'Geç geldi' : 'Late check-in';
      case 'devamsiz':
        return isTr ? 'Devamsız' : 'Absent';
      case 'erken_cikti':
        return isTr ? 'Erken çıktı' : 'Early check-out';
      case 'eksik_kayit':
      default:
        return isTr ? 'Eksik kayıt' : 'Missing record';
    }
  }, [dayStatus, isTr]);

  const eventTypeLabel = useCallback(
    (eventType: string) => {
      const labels: Record<string, string> = isTr
        ? {
            check_in: 'Giriş',
            check_out: 'Çıkış',
            break_start: 'Mola başladı',
            break_end: 'Mola bitti',
            late_notice: 'Gecikme bildirimi',
            manual_request: 'Manuel giriş talebi',
          }
        : {
            check_in: 'Check-in',
            check_out: 'Check-out',
            break_start: 'Break started',
            break_end: 'Break ended',
            late_notice: 'Late notice',
            manual_request: 'Manual check-in request',
          };
      return labels[eventType] ?? eventType;
    },
    [isTr]
  );

  const locationStatusLabel = useCallback(
    (locationStatus: string) => {
      const labels: Record<string, string> = isTr
        ? {
            verified: 'Konum doğrulandı',
            outside_hotel_radius: 'Otel alanı dışı',
            missing: 'Konum yok',
            unavailable: 'Konum kullanılamıyor',
          }
        : {
            verified: 'Location verified',
            outside_hotel_radius: 'Outside hotel radius',
            missing: 'Location missing',
            unavailable: 'Location unavailable',
          };
      return labels[locationStatus] ?? locationStatus;
    },
    [isTr]
  );

  const loadQueue = useCallback(async (): Promise<OfflineQueuedAction[]> => {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as OfflineQueuedAction[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const saveQueue = useCallback(async (items: OfflineQueuedAction[]) => {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  }, []);

  const appendQueue = useCallback(async (item: OfflineQueuedAction) => {
    const current = await loadQueue();
    current.push(item);
    await saveQueue(current);
  }, [loadQueue, saveQueue]);

  const flushOfflineQueue = useCallback(async () => {
    const current = await loadQueue();
    if (!current.length) return;
    const remaining: OfflineQueuedAction[] = [];
    for (const item of current) {
      try {
        if (item.type === 'check_in') {
          await checkInStaffAttendance(item.payload);
        } else if (item.type === 'check_out') {
          await checkOutStaffAttendance(item.payload);
        } else {
          await addStaffAttendanceEvent(item.eventType, item.note);
        }
      } catch {
        remaining.push(item);
      }
    }
    await saveQueue(remaining);
  }, [loadQueue, saveQueue]);

  const getLocationPayload = useCallback(async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') {
      return { latitude: null, longitude: null, accuracyM: null, note: isTr ? 'Konum izni yok' : 'Location permission denied' };
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracyM: pos.coords.accuracy,
      note: null as string | null,
    };
  }, [isTr]);

  const notifyAdminForAttendanceAction = useCallback(
    async (actionLabel: string, note?: string) => {
      const staffName = staff?.full_name?.trim() || 'Personel';
      const title = isTr ? 'Mesai bildirimi' : 'Attendance update';
      const bodyBase = isTr ? `${staffName}: ${actionLabel}` : `${staffName}: ${actionLabel}`;
      const body = note ? `${bodyBase} - ${note}` : bodyBase;
      await notifyAdmins({
        title,
        body,
        data: {
          url: '/admin/attendance',
          notificationType: 'staff_attendance_action',
          screen: 'admin',
        },
      });
    },
    [isTr, staff?.full_name]
  );

  const handleAction = useCallback(
    async (type: 'check_in' | 'check_out') => {
      try {
        setBusy(true);
        await flushOfflineQueue();
        const loc = await getLocationPayload();
        const payload = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracyM: loc.accuracyM,
          note: loc.note,
          source: 'mobile' as const,
          eventTime: new Date().toISOString(),
          deviceInfo: {
            platform: Constants.platform?.ios ? 'ios' : Constants.platform?.android ? 'android' : 'unknown',
            appVersion: Constants.expoConfig?.version ?? 'unknown',
          },
        };
        if (type === 'check_in') {
          await checkInStaffAttendance(payload);
          void notifyAdminForAttendanceAction(isTr ? 'giriş yaptı' : 'checked in');
          Alert.alert(isTr ? 'Başarılı' : 'Success', isTr ? 'İşe başlama kaydı alındı' : 'Check-in recorded');
        } else {
          await checkOutStaffAttendance(payload);
          void notifyAdminForAttendanceAction(isTr ? 'çıkış yaptı' : 'checked out');
          Alert.alert(isTr ? 'Başarılı' : 'Success', isTr ? 'Çıkış kaydı alındı' : 'Check-out recorded');
        }
        await q.refetch();
      } catch (error) {
        const message = error instanceof Error ? error.message : isTr ? 'Bilinmeyen hata' : 'Unknown error';
        if (/network|fetch|connection/i.test(message)) {
          await appendQueue({ type, payload: { eventTime: new Date().toISOString(), source: 'offline_sync' } });
          Alert.alert(
            isTr ? 'Offline kaydedildi' : 'Saved offline',
            isTr ? 'İnternet geldiğinde otomatik senkronize edilecek' : 'Will sync automatically when internet is available'
          );
        } else {
          Alert.alert(isTr ? 'İşlem başarısız' : 'Action failed', message);
        }
      } finally {
        setBusy(false);
      }
    },
    [appendQueue, flushOfflineQueue, getLocationPayload, isTr, q]
  );

  const addQuickEvent = useCallback(
    async (eventType: 'late_notice' | 'manual_request', note: string) => {
      try {
        setBusy(true);
        await addStaffAttendanceEvent(eventType, note);
        void notifyAdminForAttendanceAction(
          eventType === 'late_notice'
            ? isTr
              ? 'geç kalacağını bildirdi'
              : 'sent late notice'
            : isTr
              ? 'manuel giriş talebi gönderdi'
              : 'sent manual check-in request',
          note
        );
        await q.refetch();
      } catch (error) {
        const message = error instanceof Error ? error.message : isTr ? 'Bilinmeyen hata' : 'Unknown error';
        if (/network|fetch|connection/i.test(message)) {
          await appendQueue({ type: 'event', eventType, note });
          Alert.alert(
            isTr ? 'Offline kaydedildi' : 'Saved offline',
            isTr ? 'Talep internet geldiğinde gönderilecek' : 'Request will be sent when internet is available'
          );
        } else {
          Alert.alert(isTr ? 'Kaydedilemedi' : 'Could not save', message);
        }
      } finally {
        setBusy(false);
      }
    },
    [appendQueue, isTr, notifyAdminForAttendanceAction, q]
  );

  const renderEvent = ({ item }: { item: AttendanceEvent }) => (
    <View style={styles.eventRow}>
      <Text style={styles.eventTime}>{new Date(item.event_time).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.eventType}>{eventTypeLabel(item.event_type)}</Text>
        <Text style={styles.eventMeta}>
          {locationStatusLabel(item.location_status)}
          {typeof item.distance_to_hotel_m === 'number' ? ` • ${item.distance_to_hotel_m}m` : ''}
        </Text>
        {item.note ? <Text style={styles.eventMeta}>{item.note}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{isTr ? 'Mesai Takibi' : 'Attendance Tracking'}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => q.refetch()} disabled={q.isFetching}>
          <Text style={styles.refreshBtnText}>{isTr ? 'Yenile' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>{isTr ? 'Bugünkü durum' : "Today's status"}</Text>
        <Text style={styles.value}>{statusLabel}</Text>
        <Text style={styles.sub}>
          {isTr ? 'Giriş' : 'Check-in'}: {report.check_in_at ? new Date(report.check_in_at).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }) : '-'}
        </Text>
        <Text style={styles.sub}>
          {isTr ? 'Çıkış' : 'Check-out'}:{' '}
          {report.check_out_at ? new Date(report.check_out_at).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }) : '-'}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => handleAction('check_in')} disabled={busy}>
          <Text style={styles.primaryBtnText}>{isTr ? 'İşe Başladım' : 'I Started Working'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, styles.outBtn]} onPress={() => handleAction('check_out')} disabled={busy}>
          <Text style={styles.primaryBtnText}>{isTr ? 'Çıkış Yaptım' : 'I Checked Out'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => addQuickEvent('late_notice', isTr ? 'Geç kalıyorum bildirimi' : 'Late arrival notice')}
        >
          <Text style={styles.linkText}>{isTr ? 'Geç kalıyorum' : 'Running late'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => addQuickEvent('manual_request', isTr ? 'Manuel giriş talebi' : 'Manual check-in request')}
        >
          <Text style={styles.linkText}>{isTr ? 'Manuel giriş talebi' : 'Manual check-in request'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={q.data?.events ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={<Text style={styles.empty}>{isTr ? 'Bugün henüz kayıt yok' : 'No records yet today'}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary, padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  refreshBtn: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshBtnText: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 12,
    gap: 4,
  },
  label: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '700' },
  value: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  sub: { color: theme.colors.textSecondary, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: theme.colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  outBtn: { backgroundColor: '#0f766e' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  quickActions: { flexDirection: 'row', gap: 8 },
  linkBtn: { flex: 1, borderWidth: 1, borderColor: theme.colors.borderLight, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  linkText: { color: theme.colors.text, fontWeight: '700', fontSize: 12 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  eventTime: { width: 54, fontWeight: '800', color: theme.colors.text },
  eventType: { fontWeight: '700', color: theme.colors.text },
  eventMeta: { color: theme.colors.textSecondary, fontSize: 12 },
  empty: { color: theme.colors.textSecondary, marginTop: 10 },
});
