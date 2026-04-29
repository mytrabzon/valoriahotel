import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, TextInput, Modal, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminTheme } from '@/constants/adminTheme';
import { listDocumentCategories, upsertDocumentCategory, type DocumentCategoryRow } from '@/lib/documentManagement';
import { useAuthStore } from '@/stores/authStore';

export default function AdminDocumentsCategories() {
  const staff = useAuthStore((s) => s.staff);
  const [rows, setRows] = useState<DocumentCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listDocumentCategories();
    if (!res.error && res.data) setRows(res.data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createCategory = async () => {
    if (!name.trim()) {
      Alert.alert('Eksik', 'Kategori adı zorunlu.');
      return;
    }
    if (!staff?.organization_id) {
      Alert.alert('Hata', 'Oturum/işletme bulunamadı.');
      return;
    }
    const res = await upsertDocumentCategory({
      organizationId: staff.organization_id,
      name: name.trim(),
      description: description.trim() || null,
      requiresApproval,
      isActive: true,
    });
    if (res.error) {
      Alert.alert('Hata', res.error.message);
      return;
    }
    setModalOpen(false);
    setName('');
    setDescription('');
    setRequiresApproval(false);
    await load();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Text style={styles.sub}>{loading ? 'Yükleniyor…' : 'Kategori yok'}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowMeta} numberOfLines={2}>
                {item.requires_approval ? 'Onay gerekli' : 'Onay yok'}
                {item.description ? ` · ${item.description}` : ''}
              </Text>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setModalOpen(true)}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Yeni kategori</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Kategori adı" placeholderTextColor={adminTheme.colors.textMuted} />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Açıklama (opsiyonel)"
              placeholderTextColor={adminTheme.colors.textMuted}
              multiline
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Onay gerekli</Text>
              <Switch value={requiresApproval} onValueChange={setRequiresApproval} trackColor={{ false: '#cbd5e0', true: adminTheme.colors.accent }} thumbColor="#fff" />
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={createCategory} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>Kaydet</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  content: { padding: 20, paddingBottom: 96 },
  sub: { fontSize: 13, fontWeight: '600', color: adminTheme.colors.textMuted, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: adminTheme.colors.surface,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 15, fontWeight: '800', color: adminTheme.colors.text },
  rowMeta: { marginTop: 4, fontSize: 12, fontWeight: '600', color: adminTheme.colors.textMuted },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: adminTheme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: adminTheme.colors.surface, borderRadius: adminTheme.radius.lg, padding: 14, borderWidth: 1, borderColor: adminTheme.colors.border },
  modalTitle: { fontSize: 16, fontWeight: '900', color: adminTheme.colors.text, marginBottom: 10 },
  input: { backgroundColor: adminTheme.colors.surfaceSecondary, borderRadius: adminTheme.radius.lg, padding: 12, borderWidth: 1, borderColor: adminTheme.colors.border, color: adminTheme.colors.text, marginBottom: 10 },
  textArea: { minHeight: 80, textAlignVertical: 'top' as any },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: adminTheme.colors.text },
  primaryBtn: { backgroundColor: adminTheme.colors.accent, borderRadius: adminTheme.radius.lg, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
