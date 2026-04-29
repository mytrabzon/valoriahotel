import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { getOrCreateGuestForCurrentSession } from '@/lib/getOrCreateGuestForCaller';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import {
  complaintsText,
  complaintStatusLabel,
  complaintTypeLabel,
  complaintsLocaleTag,
} from '@/lib/complaintsI18n';

type ComplaintRow = {
  id: string;
  topic_type: 'complaint' | 'suggestion' | 'thanks';
  category: string;
  status: string;
  created_at: string;
  description: string;
};

export default function CustomerComplaintsTab() {
  useTranslation();
  const loc = complaintsLocaleTag();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<ComplaintRow[]>([]);

  const load = useCallback(async () => {
    const guest = await getOrCreateGuestForCurrentSession();
    if (!guest?.guest_id) {
      setList([]);
      return;
    }
    const { data } = await supabase
      .from('guest_complaints')
      .select('id, topic_type, category, status, created_at, description')
      .eq('guest_id', guest.guest_id)
      .order('created_at', { ascending: false })
      .limit(30);
    setList((data as ComplaintRow[]) ?? []);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setLoading(true);
    await load();
    setLoading(false);
  }, [load]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{complaintsText('complaintsSystem')}</Text>
        <Text style={styles.heroText}>{complaintsText('complaintSystemDesc')}</Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.push('/customer/complaints/new')} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.ctaText}>{complaintsText('newReport')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{complaintsText('myRecentReports')}</Text>
      {loading && list.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{complaintsText('noReports')}</Text>
        </View>
      ) : (
        list.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(`/customer/complaints/${item.id}`)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.type}>{complaintTypeLabel(item.topic_type)}</Text>
              <Text style={styles.status}>{complaintStatusLabel(item.status)}</Text>
            </View>
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleString(loc)}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: 14, paddingBottom: 32 },
  hero: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 14,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  heroText: { marginTop: 6, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  cta: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.error,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { marginTop: 16, marginBottom: 10, fontSize: 15, fontWeight: '700', color: theme.colors.text },
  loadingWrap: { paddingVertical: 26, alignItems: 'center' },
  emptyWrap: { paddingVertical: 18, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  status: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  desc: { marginTop: 8, fontSize: 13, color: theme.colors.textSecondary },
  date: { marginTop: 6, fontSize: 11, color: theme.colors.textMuted },
});
