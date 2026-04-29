import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { adminTheme } from '@/constants/adminTheme';
import { useAuthStore } from '@/stores/authStore';

type Row = {
  id: string;
  note: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  admin_action_note: string | null;
  created_at: string;
  complainant_staff_id: string;
  complained_staff_id: string;
  complainant?: { full_name: string | null } | null;
  complained?: { full_name: string | null } | null;
};

const STATUS_LABEL: Record<Row['status'], string> = {
  open: 'Açık',
  reviewing: 'İnceleniyor',
  resolved: 'Çözüldü',
  dismissed: 'Kapatıldı',
};

export default function AdminStaffComplaintsScreen() {
  const { staff } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('staff_internal_complaints')
      .select(
        'id, note, status, admin_action_note, created_at, complainant_staff_id, complained_staff_id, complainant:complainant_staff_id(full_name), complained:complained_staff_id(full_name)'
      )
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    const list = (data ?? []) as Row[];
    setRows(list);
    const n: Record<string, string> = {};
    list.forEach((r) => {
      n[r.id] = r.admin_action_note ?? '';
    });
    setNotes(n);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const updateStatus = async (row: Row, status: Row['status']) => {
    if (!staff?.id) return;
    setSavingId(row.id);
    const { error } = await supabase
      .from('staff_internal_complaints')
      .update({
        status,
        admin_action_note: (notes[row.id] ?? '').trim() || null,
        handled_by_staff_id: staff.id,
        handled_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    setSavingId(null);
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    await load();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={async () => { setLoading(true); await load(); setLoading(false); }} />}
    >
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Personel İç Şikayetleri</Text>
        <Text style={styles.bannerSub}>
          Bu ekran yalnızca otel sorumlusu içindir. İşlem durumu şikayet eden personele gösterilmez.
        </Text>
      </View>

      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={adminTheme.colors.accent} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Kayıt bulunamadı.</Text>
        </View>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.title}>
              Şikayet Eden: {r.complainant?.full_name || r.complainant_staff_id}
            </Text>
            <Text style={styles.title}>
              Şikayet Edilen: {r.complained?.full_name || r.complained_staff_id}
            </Text>
            <Text style={styles.meta}>{new Date(r.created_at).toLocaleString('tr-TR')} · {STATUS_LABEL[r.status]}</Text>
            <Text style={styles.note}>{r.note}</Text>

            <TextInput
              style={styles.input}
              value={notes[r.id] ?? ''}
              onChangeText={(v) => setNotes((p) => ({ ...p, [r.id]: v }))}
              placeholder="Sadece yönetici notu"
              placeholderTextColor={adminTheme.colors.textMuted}
              multiline
            />

            <View style={styles.actions}>
              {(['reviewing', 'resolved', 'dismissed'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.btn, r.status === s && styles.btnActive]}
                  disabled={savingId === r.id}
                  onPress={() => updateStatus(r, s)}
                >
                  <Text style={[styles.btnText, r.status === s && styles.btnTextActive]}>{STATUS_LABEL[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  content: { padding: 16, paddingBottom: 36 },
  center: { paddingVertical: 30, alignItems: 'center' },
  empty: { color: adminTheme.colors.textMuted },
  banner: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fdba74',
    padding: 12,
    marginBottom: 12,
  },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: '#9a3412' },
  bannerSub: { marginTop: 4, fontSize: 12, lineHeight: 18, color: '#7c2d12' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  title: { fontSize: 13, fontWeight: '700', color: adminTheme.colors.text },
  meta: { marginTop: 4, fontSize: 11, color: adminTheme.colors.textMuted },
  note: { marginTop: 8, fontSize: 13, lineHeight: 20, color: adminTheme.colors.text },
  input: {
    marginTop: 10,
    minHeight: 70,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
    color: adminTheme.colors.text,
    backgroundColor: adminTheme.colors.surfaceSecondary,
  },
  actions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  btn: {
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  btnActive: { backgroundColor: adminTheme.colors.primary, borderColor: adminTheme.colors.primary },
  btnText: { fontSize: 12, fontWeight: '700', color: adminTheme.colors.textSecondary },
  btnTextActive: { color: '#fff' },
});

