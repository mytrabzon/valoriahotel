import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { NotificationTemplateRow } from '@/lib/notifications';

const CATEGORY_LABELS: Record<string, string> = {
  info: 'Bilgi',
  warning: 'Uyarı',
  campaign: 'Kampanya',
  event: 'Etkinlik',
  reminder: 'Hatırlatma',
  meeting: 'Toplantı',
  urgent: 'Acil',
};

function TemplateCard({ item }: { item: NotificationTemplateRow }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{item.title_template}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{CATEGORY_LABELS[item.category] ?? item.category}</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>{item.body_template}</Text>
      {item.is_system ? <Text style={styles.systemNote}>Sistem şablonu</Text> : null}
    </View>
  );
}

export default function NotificationTemplatesScreen() {
  const [guestTemplates, setGuestTemplates] = useState<NotificationTemplateRow[]>([]);
  const [staffTemplates, setStaffTemplates] = useState<NotificationTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notification_templates')
      .select('*')
      .order('sort_order')
      .order('template_key');
    const list = (data as NotificationTemplateRow[]) ?? [];
    setGuestTemplates(list.filter((t) => t.target_audience === 'guest'));
    setStaffTemplates(list.filter((t) => t.target_audience === 'staff'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.sectionTitle}>Misafir şablonları</Text>
      {guestTemplates.length === 0 ? (
        <Text style={styles.empty}>Şablon yok</Text>
      ) : (
        guestTemplates.map((t) => <TemplateCard key={t.id} item={t} />)
      )}
      <Text style={styles.sectionTitle}>Personel şablonları</Text>
      {staffTemplates.length === 0 ? (
        <Text style={styles.empty}>Şablon yok</Text>
      ) : (
        staffTemplates.map((t) => <TemplateCard key={t.id} item={t} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#2d3748', marginTop: 20, marginBottom: 8 },
  empty: { color: '#a0aec0', fontSize: 14, paddingVertical: 12 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a202c', flex: 1 },
  badge: { backgroundColor: '#edf2f7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, color: '#4a5568' },
  cardBody: { fontSize: 14, color: '#4a5568' },
  systemNote: { fontSize: 11, color: '#a0aec0', marginTop: 8 },
});
