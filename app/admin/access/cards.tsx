import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type CardRow = {
  id: string;
  serial_number: string;
  card_type: string;
  guest_id: string | null;
  staff_id: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  all_doors: boolean;
  guests: { full_name: string | null } | null;
  staff: { full_name: string | null } | null;
};

const CARD_TYPE_LABELS: Record<string, string> = {
  guest: 'Misafir',
  vip_guest: 'VIP',
  housekeeping: 'Temizlik',
  technical: 'Teknik',
  security: 'Güvenlik',
  manager: 'Yönetici',
  temporary: 'Geçici',
};

function formatDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('tr-TR');
}

export default function AccessCardsScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('access_cards')
      .select('id, serial_number, card_type, guest_id, staff_id, valid_from, valid_until, is_active, all_doors, guests(full_name), staff(full_name)')
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    setCards((data as CardRow[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    setLoading(false);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const revoke = (card: CardRow) => {
    Alert.alert('Kartı iptal et', `"${card.serial_number}" kartını iptal etmek istediğinize emin misiniz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İptal et',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('access_cards')
            .update({ is_active: false, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', card.id);
          if (error) Alert.alert('Hata', error.message);
          else await load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a365d" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/admin/access/cards/new')}>
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.addBtnText}>Yeni kart tanımla</Text>
      </TouchableOpacity>
      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a365d']} />}
        renderItem={({ item }) => {
          const person = item.guests?.full_name ?? item.staff?.full_name ?? '—';
          const validUntil = item.valid_until ? new Date(item.valid_until) : null;
          const expired = validUntil && validUntil < new Date();
          return (
            <TouchableOpacity
              style={[styles.card, !item.is_active && styles.cardInactive]}
              onPress={() => router.push(`/admin/access/cards/${item.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.cardRow}>
                <View style={styles.cardMain}>
                  <Text style={styles.serial}>{item.serial_number}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.badge, { backgroundColor: item.card_type === 'guest' ? '#3182ce' : '#718096' }]}>
                      <Text style={styles.badgeText}>{CARD_TYPE_LABELS[item.card_type] ?? item.card_type}</Text>
                    </View>
                    <Text style={styles.person}>{person}</Text>
                  </View>
                  <Text style={styles.validity}>
                    {formatDate(item.valid_from)} – {formatDate(item.valid_until)}
                    {item.all_doors ? ' · Tüm kapılar' : ''}
                  </Text>
                  {expired && <Text style={styles.expired}>Süresi dolmuş</Text>}
                </View>
                <Ionicons name="chevron-forward" size={22} color="#a0aec0" />
              </View>
              {item.is_active && (
                <TouchableOpacity style={styles.revokeBtn} onPress={() => revoke(item)}>
                  <Text style={styles.revokeText}>İptal et</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Henüz kart tanımlı değil.</Text>
            <Text style={styles.emptyHint}>Misafir veya personel kartı ekleyin; seri no ve açılacak kapıları belirleyin.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7fafc' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 16,
    backgroundColor: '#1a365d',
    borderRadius: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  list: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardInactive: { opacity: 0.7, borderColor: '#cbd5e0' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMain: { flex: 1 },
  serial: { fontSize: 17, fontWeight: '700', color: '#1a202c' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  person: { fontSize: 14, color: '#4a5568' },
  validity: { fontSize: 13, color: '#718096', marginTop: 4 },
  expired: { fontSize: 12, color: '#e53e3e', marginTop: 2 },
  revokeBtn: { marginTop: 10, alignSelf: 'flex-start' },
  revokeText: { fontSize: 13, color: '#e53e3e' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#4a5568' },
  emptyHint: { fontSize: 14, color: '#718096', marginTop: 8, textAlign: 'center' },
});
