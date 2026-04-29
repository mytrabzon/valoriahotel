import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { listEmergencyLocations, notifyStaffEmergency, type EmergencyLocation } from '@/lib/staffEmergency';

export default function StaffEmergencyScreen() {
  const { t } = useTranslation();
  const { staff } = useAuthStore();
  const [locations, setLocations] = useState<EmergencyLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedLocation = useMemo(
    () => locations.find((item) => item.id === selectedId) ?? null,
    [locations, selectedId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listEmergencyLocations(true);
    setLoading(false);
    if (res.error) {
      Alert.alert(t('error'), res.error);
      return;
    }
    setLocations(res.data);
    if (res.data.length > 0 && !selectedId) {
      setSelectedId(res.data[0].id);
    }
  }, [selectedId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSend = async () => {
    if (!staff?.id) {
      Alert.alert(t('error'), t('staffEmergencySessionMissing'));
      return;
    }
    if (!selectedLocation) {
      Alert.alert(t('staffEmergencyMissingInfoTitle'), t('staffEmergencySelectLocation'));
      return;
    }
    Alert.alert(
      t('staffEmergencyConfirmTitle'),
      t('staffEmergencyConfirmBody', { location: selectedLocation.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('staffEmergencySendCta'),
          style: 'destructive',
          onPress: async () => {
            setSending(true);
            const res = await notifyStaffEmergency({
              locationName: selectedLocation.name,
              note,
              createdByStaffId: staff.id,
              createdByName: staff.full_name,
            });
            setSending(false);
            if (res.error) {
              Alert.alert(t('error'), res.error);
              return;
            }
            Alert.alert(t('staffEmergencySentTitle'), t('staffEmergencySentBody', { count: res.count }));
            setNote('');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('screenEmergencyButton')}</Text>
      <Text style={styles.sub}>{t('staffEmergencySubtitle')}</Text>

      <Text style={styles.label}>{t('staffEmergencyLocationLabel')}</Text>
      <View style={styles.chipsWrap}>
        {locations.map((item) => {
          const active = item.id === selectedId;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedId(item.id)}
              disabled={sending}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>{t('staffEmergencyNoteLabel')}</Text>
      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder={t('staffEmergencyNotePlaceholder')}
        placeholderTextColor="#94a3b8"
        multiline
      />

      <TouchableOpacity
        style={[styles.sendBtn, (sending || loading) && styles.sendBtnDisabled]}
        onPress={onSend}
        disabled={sending || loading}
      >
        <Text style={styles.sendBtnText}>{sending ? t('staffEmergencySending') : t('staffEmergencySubmit')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 30 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  sub: { marginTop: 6, color: '#475569', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8, marginTop: 4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chipActive: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  chipText: { color: '#1e293b', fontWeight: '600' },
  chipTextActive: { color: '#b91c1c' },
  noteInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    color: '#0f172a',
  },
  sendBtn: {
    marginTop: 18,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
