import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getGuestNotificationToken } from '@/lib/guestNotificationToken';
import { GUEST_PREF_KEYS } from '@/lib/notifications';
import { savePushTokenForGuest } from '@/lib/notificationsPush';

type NotifRow = {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

const PREF_LABELS: Record<string, string> = {
  [GUEST_PREF_KEYS.service_updates]: 'Hizmet bildirimleri (taleplerim)',
  [GUEST_PREF_KEYS.checkin_checkout_reminders]: 'Check-in/out hatırlatmaları',
  [GUEST_PREF_KEYS.hotel_announcements]: 'Otel duyuruları',
  [GUEST_PREF_KEYS.campaigns]: 'Kampanya ve fırsatlar',
  [GUEST_PREF_KEYS.marketing]: 'Pazarlama mesajları',
};

export default function CustomerNotificationsScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [list, setList] = useState<NotifRow[]>([]);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const load = async () => {
    const t = await getGuestNotificationToken();
    setToken(t);
    if (!t) {
      setList([]);
      setLoading(false);
      return;
    }
    savePushTokenForGuest(t).catch(() => {});
    const { data } = await supabase.rpc('get_guest_notifications', { p_app_token: t });
    setList((data as NotifRow[]) ?? []);
    const { data: prefsData } = await supabase.rpc('get_guest_notification_preferences', { p_app_token: t });
    const map: Record<string, boolean> = {};
    (prefsData as { pref_key: string; enabled: boolean }[] ?? []).forEach((p) => {
      map[p.pref_key] = p.enabled;
    });
    setPrefs(map);
    setPrefsLoaded(true);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const togglePref = async (key: string, enabled: boolean) => {
    if (!token) return;
    await supabase.rpc('set_guest_notification_preference', {
      p_app_token: token,
      p_pref_key: key,
      p_enabled: enabled,
    });
    setPrefs((p) => ({ ...p, [key]: enabled }));
  };

  if (!token) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Bildirimler</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Bildirimleri görmek için giriş yapın</Text>
          <Text style={styles.emptyDesc}>
            Oda QR kodunu tarayıp sözleşme ve doğrulama adımlarını tamamladığınızda bildirimleriniz burada listelenir.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.push('/guest')}>
            <Text style={styles.btnText}>Oda girişi yap</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>Bildirimler</Text>
      {list.length === 0 && !loading ? (
        <Text style={styles.noList}>Henüz bildirim yok.</Text>
      ) : (
        list.map((n) => (
          <View key={n.id} style={[styles.row, n.read_at ? styles.rowRead : null]}>
            <Text style={styles.rowTitle}>{n.title}</Text>
            {n.body ? <Text style={styles.rowBody}>{n.body}</Text> : null}
            <Text style={styles.rowTime}>{new Date(n.created_at).toLocaleString('tr-TR')}</Text>
          </View>
        ))
      )}
      <Text style={styles.sectionTitle}>Bildirim ayarlarım</Text>
      {prefsLoaded &&
        Object.entries(GUEST_PREF_KEYS).map(([k, key]) => (
          <View key={key} style={styles.prefRow}>
            <Text style={styles.prefLabel}>{PREF_LABELS[key] ?? key}</Text>
            <TouchableOpacity
              style={[styles.toggle, prefs[key] !== false && styles.toggleOn]}
              onPress={() => togglePref(key, prefs[key] === false)}
            >
              <Text style={styles.toggleText}>{prefs[key] !== false ? 'Açık' : 'Kapalı'}</Text>
            </TouchableOpacity>
          </View>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a202c', marginBottom: 16 },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#2d3748', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#718096', marginBottom: 20 },
  btn: { backgroundColor: '#b8860b', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  noList: { color: '#a0aec0', fontSize: 14 },
  row: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowRead: { opacity: 0.85 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#1a202c', marginBottom: 4 },
  rowBody: { fontSize: 14, color: '#4a5568', marginBottom: 8 },
  rowTime: { fontSize: 12, color: '#a0aec0' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#2d3748', marginTop: 28, marginBottom: 12 },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  prefLabel: { fontSize: 15, color: '#2d3748' },
  toggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#e2e8f0' },
  toggleOn: { backgroundColor: '#c6f6d5' },
  toggleText: { fontSize: 13, color: '#2d3748', fontWeight: '500' },
});
