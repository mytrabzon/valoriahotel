import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { listMaliyeTokens, revokeMaliyeToken, updateMaliyeTokenPin } from '@/lib/maliyeAccess';

type TokenRow = {
  id: string;
  token: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

export default function AdminMaliyeAccess() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listMaliyeTokens();
    if (!res.error) setRows((res.data as TokenRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: string) => {
    const res = await revokeMaliyeToken(id);
    if (res.error) return Alert.alert('Hata', res.error.message);
    await load();
  };

  const changePin = async (id: string) => {
    const pin = (pinDrafts[id] ?? '').trim();
    if (pin.length < 4) return Alert.alert('Eksik', 'Yeni PIN en az 4 karakter olmalı.');
    const res = await updateMaliyeTokenPin(id, pin);
    if (res.error) return Alert.alert('Hata', res.error.message);
    setPinDrafts((prev) => ({ ...prev, [id]: '' }));
    Alert.alert('Tamam', 'PIN güncellendi.');
    await load();
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.token}>{item.token}</Text>
            <Text style={styles.meta}>Bitiş: {new Date(item.expires_at).toLocaleString('tr-TR')}</Text>
            <Text style={styles.meta}>Son kullanım: {item.last_used_at ? new Date(item.last_used_at).toLocaleString('tr-TR') : '-'}</Text>
            <Text style={styles.meta}>Durum: {item.is_active ? 'Aktif' : 'Pasif'}</Text>
            {item.is_active ? (
              <>
                <TextInput
                  style={styles.input}
                  value={pinDrafts[item.id] ?? ''}
                  onChangeText={(v) => setPinDrafts((prev) => ({ ...prev, [item.id]: v }))}
                  placeholder="Yeni PIN (min 4)"
                  secureTextEntry
                />
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.btn, styles.blue]} onPress={() => changePin(item.id)}>
                    <Text style={styles.btnText}>PIN Değiştir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.red]} onPress={() => revoke(item.id)}>
                    <Text style={styles.btnText}>İptal Et</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 14 },
  card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 8 },
  token: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: '#0f172a' },
  meta: { color: '#64748b', marginTop: 3 },
  input: { marginTop: 8, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  blue: { backgroundColor: '#1d4ed8' },
  red: { backgroundColor: '#b91c1c' },
  btnText: { color: '#fff', fontWeight: '700' },
});
