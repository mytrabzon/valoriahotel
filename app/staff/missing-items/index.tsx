import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import {
  createMissingItem,
  listMissingItems,
  resolveMissingItem,
  type MissingItemPriority,
  type MissingItemRow,
} from '@/lib/missingItems';

type TabKey = 'open' | 'resolved';

const PRIORITY_LABEL: Record<MissingItemPriority, string> = {
  low: 'Dusuk',
  medium: 'Orta',
  high: 'Yuksek',
};

const PRIORITY_COLOR: Record<MissingItemPriority, string> = {
  low: '#6c757d',
  medium: theme.colors.primary,
  high: theme.colors.error,
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function StaffMissingItemsScreen() {
  const staff = useAuthStore((s) => s.staff);
  const [tab, setTab] = useState<TabKey>('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openItems, setOpenItems] = useState<MissingItemRow[]>([]);
  const [resolvedItems, setResolvedItems] = useState<MissingItemRow[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MissingItemPriority>('medium');

  const activeItems = useMemo(() => (tab === 'open' ? openItems : resolvedItems), [openItems, resolvedItems, tab]);

  const loadAll = useCallback(async () => {
    const [openRes, resolvedRes] = await Promise.all([listMissingItems('open'), listMissingItems('resolved')]);
    if (openRes.error) Alert.alert('Hata', openRes.error);
    if (resolvedRes.error) Alert.alert('Hata', resolvedRes.error);
    setOpenItems(openRes.data);
    setResolvedItems(resolvedRes.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const onCreate = async () => {
    if (!staff?.id || !staff?.organization_id) return;
    setSaving(true);
    const result = await createMissingItem({
      staffId: staff.id,
      organizationId: staff.organization_id,
      title,
      description,
      priority,
    });
    setSaving(false);
    if (result.error) {
      Alert.alert('Hata', result.error);
      return;
    }
    setModalVisible(false);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setTab('open');
    loadAll();
  };

  const onResolve = (id: string) => {
    Alert.alert('Eksik giderildi mi?', 'Bu kaydi giderildi olarak isaretlemek istiyor musunuz?', [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Giderildi',
        style: 'default',
        onPress: async () => {
          const result = await resolveMissingItem(id);
          if (result.error) {
            Alert.alert('Hata', result.error);
            return;
          }
          loadAll();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'open' && styles.tabBtnActive]} onPress={() => setTab('open')}>
          <Text style={[styles.tabText, tab === 'open' && styles.tabTextActive]}>Eksik Var</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'resolved' && styles.tabBtnActive]} onPress={() => setTab('resolved')}>
          <Text style={[styles.tabText, tab === 'resolved' && styles.tabTextActive]}>Giderildi</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeItems}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {tab === 'open' ? 'Eksik Var kayitlari' : 'Giderilen eksikler'}
            </Text>
            {tab === 'open' ? (
              <TouchableOpacity style={styles.newBtn} onPress={() => setModalVisible(true)}>
                <Ionicons name="add" size={18} color={theme.colors.white} />
                <Text style={styles.newBtnText}>Eksik Ekle</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-outline" size={42} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>
              {loading ? 'Yukleniyor...' : tab === 'open' ? 'Acik eksik yok.' : 'Henuz giderilen eksik yok.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={[styles.priorityPill, { borderColor: PRIORITY_COLOR[item.priority] }]}>
                <Text style={[styles.priorityText, { color: PRIORITY_COLOR[item.priority] }]}>
                  {PRIORITY_LABEL[item.priority]}
                </Text>
              </View>
            </View>
            {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
            <Text style={styles.metaText}>
              Ekleyen: {item.creator?.full_name || '-'} - {formatDateTime(item.created_at)}
            </Text>
            {item.status === 'resolved' ? (
              <Text style={styles.metaText}>
                Gideren: {item.resolver?.full_name || '-'} - {formatDateTime(item.resolved_at)}
              </Text>
            ) : (
              <Text style={styles.metaText}>Hatirlatma: {item.reminder_count} kez</Text>
            )}
            {item.status === 'open' ? (
              <TouchableOpacity style={styles.resolveBtn} onPress={() => onResolve(item.id)}>
                <Text style={styles.resolveBtnText}>Giderildi</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni eksik kaydi</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Baslik (orn. Sampuan eksik)"
              style={styles.input}
              maxLength={100}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Aciklama"
              style={[styles.input, styles.textarea]}
              multiline
              maxLength={400}
            />
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high'] as MissingItemPriority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityOption, priority === p && styles.priorityOptionActive]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.priorityOptionText, priority === p && styles.priorityOptionTextActive]}>
                    {PRIORITY_LABEL[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Vazgec</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={onCreate} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabBtn: {
    flex: 1,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: theme.colors.borderLight,
  },
  tabBtnActive: { backgroundColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.white },
  listContent: { padding: theme.spacing.lg, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  newBtnText: { color: theme.colors.white, fontSize: 12, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingTop: 50, gap: 8 },
  emptyText: { color: theme.colors.textMuted, fontSize: 14 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: theme.colors.text },
  priorityPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { fontSize: 11, fontWeight: '700' },
  cardDesc: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 8, marginBottom: 8, lineHeight: 20 },
  metaText: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  resolveBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.success,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resolveBtnText: { color: theme.colors.white, fontWeight: '700', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 10,
    backgroundColor: theme.colors.background,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  priorityOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  priorityOptionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight + '20' },
  priorityOptionText: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  priorityOptionTextActive: { color: theme.colors.primaryDark, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  cancelBtnText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '700' },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  saveBtnText: { color: theme.colors.white, fontSize: 13, fontWeight: '700' },
});
