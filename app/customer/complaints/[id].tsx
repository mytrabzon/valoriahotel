import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { getOrCreateGuestForCurrentSession } from '@/lib/getOrCreateGuestForCaller';
import { CachedImage } from '@/components/CachedImage';
import { useTranslation } from 'react-i18next';
import {
  complaintCategoryLabel,
  complaintStatusLabel,
  complaintTypeLabel,
  complaintsText,
  complaintsLocaleTag,
  guestComplaintTimelineManagerDesc,
} from '@/lib/complaintsI18n';

type ComplaintDetailRow = {
  id: string;
  topic_type: 'complaint' | 'suggestion' | 'thanks';
  category: string;
  status: string;
  description: string;
  phone: string | null;
  room_number: string | null;
  image_url: string | null;
  admin_note: string | null;
  reviewed_by_staff_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  reviewed_by?: { id: string; full_name: string | null; profile_image: string | null } | null;
};

export default function CustomerComplaintDetailScreen() {
  useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const complaintId = String(params.id ?? '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [row, setRow] = useState<ComplaintDetailRow | null>(null);

  const load = useCallback(async () => {
    const guest = await getOrCreateGuestForCurrentSession();
    if (!guest?.guest_id || !complaintId) {
      setRow(null);
      return;
    }
    const { data } = await supabase
      .from('guest_complaints')
      .select('id, topic_type, category, status, description, phone, room_number, image_url, admin_note, reviewed_by_staff_id, reviewed_at, created_at, updated_at, reviewed_by:reviewed_by_staff_id(id, full_name, profile_image)')
      .eq('id', complaintId)
      .eq('guest_id', guest.guest_id)
      .maybeSingle();
    setRow((data as ComplaintDetailRow | null) ?? null);
  }, [complaintId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!complaintId) return;
    const channel = supabase
      .channel(`guest-complaint-${complaintId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_complaints', filter: `id=eq.${complaintId}` },
        () => {
          load().catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [complaintId, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const loc = complaintsLocaleTag();
  const managerName = (row?.reviewed_by?.full_name ?? '').trim() || complaintsText('defaultManagerName');
  const timeline = useMemo(() => {
    if (!row) return [];
    const out: { id: string; icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; at: string }[] = [];
    out.push({
      id: 'created',
      icon: 'paper-plane-outline',
      title: complaintsText('timelineReceivedTitle'),
      desc: complaintsText('timelineReceivedDesc'),
      at: row.created_at,
    });
    out.push({
      id: 'status',
      icon: 'pulse-outline',
      title: complaintStatusLabel(row.status),
      desc: complaintsText('timelineStatusDesc'),
      at: row.updated_at,
    });
    if (row.reviewed_at) {
      out.push({
        id: 'reviewed',
        icon: 'shield-checkmark-outline',
        title: complaintsText('timelineManagerReviewingTitle'),
        desc: guestComplaintTimelineManagerDesc(managerName),
        at: row.reviewed_at,
      });
    }
    if (row.admin_note?.trim()) {
      out.push({
        id: 'note',
        icon: 'chatbox-ellipses-outline',
        title: complaintsText('timelineAdminNoteTitle'),
        desc: row.admin_note.trim(),
        at: row.updated_at,
      });
    }
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [row, managerName]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!row) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{complaintsText('detailNotFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.type}>{complaintTypeLabel(row.topic_type)}</Text>
          <Text style={styles.status}>{complaintStatusLabel(row.status)}</Text>
        </View>
        <Text style={styles.meta}>{complaintCategoryLabel(row.category)}</Text>
        <Text style={styles.desc}>{row.description}</Text>
        <Text style={styles.meta}>
          {complaintsText('createdAtLabel')}: {new Date(row.created_at).toLocaleString(loc)}
        </Text>
      </View>

      <View style={styles.managerCard}>
        {row.reviewed_by?.profile_image ? (
          <CachedImage uri={row.reviewed_by.profile_image} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{managerName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.managerTitle}>{complaintsText('timelineManagerReviewingTitle')}</Text>
          <Text style={styles.managerName}>{managerName}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{complaintsText('flowSectionTitle')}</Text>
      <View style={styles.timeline}>
        {timeline.map((item) => (
          <View key={item.id} style={styles.timelineRow}>
            <View style={styles.timelineIconWrap}>
              <Ionicons name={item.icon} size={16} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>{item.title}</Text>
              <Text style={styles.timelineDesc}>{item.desc}</Text>
              <Text style={styles.timelineAt}>{new Date(item.at).toLocaleString(loc)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { padding: 14, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.backgroundSecondary },
  emptyText: { color: theme.colors.textMuted, fontSize: 14 },
  headerCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 14,
    padding: 14,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  type: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  status: { fontSize: 12, fontWeight: '800', color: theme.colors.primary },
  meta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  desc: { fontSize: 14, color: theme.colors.text, lineHeight: 21, marginTop: 8 },
  managerCard: {
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.primary}22`,
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: theme.colors.primary },
  managerTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  managerName: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  sectionTitle: { marginTop: 14, marginBottom: 8, fontSize: 15, fontWeight: '800', color: theme.colors.text },
  timeline: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 14,
    paddingVertical: 6,
  },
  timelineRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  timelineIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.primary}12`,
    marginTop: 2,
  },
  timelineTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  timelineDesc: { marginTop: 2, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  timelineAt: { marginTop: 4, fontSize: 11, color: theme.colors.textMuted },
});
