import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGuestMessagingStore } from '@/stores/guestMessagingStore';
import { guestListConversations } from '@/lib/messagingApi';
import type { ConversationWithMeta } from '@/lib/messaging';
import { MESSAGING_COLORS } from '@/lib/messaging';
import { supabase } from '@/lib/supabase';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (d.getTime() > now.getTime() - 86400000 * 2) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export default function CustomerMessagesScreen() {
  const router = useRouter();
  const { appToken, setAppToken, loadStoredToken } = useGuestMessagingStore();
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [loginToken, setLoginToken] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    loadStoredToken();
  }, []);

  useEffect(() => {
    if (!appToken) {
      setConversations([]);
      setLoading(false);
      return;
    }
    loadConversations();
    const interval = setInterval(loadConversations, 15000);
    return () => clearInterval(interval);
  }, [appToken]);

  const loadConversations = async () => {
    if (!appToken) return;
    setRefreshing(true);
    const { data: identity } = await supabase.rpc('get_guest_messaging_identity', { p_app_token: appToken });
    const row = Array.isArray(identity) ? identity[0] : identity;
    if (row) setGuestName((row as { full_name: string }).full_name ?? null);
    const list = await guestListConversations(appToken);
    setConversations(list);
    setRefreshing(false);
    setLoading(false);
  };

  const handleLoginWithToken = async () => {
    const token = loginToken.trim();
    if (!token) {
      setLoginError('Lütfen giriş kodunu girin.');
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    const { data } = await supabase.rpc('get_guest_messaging_identity', { p_app_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    if (row && (row as { guest_id: string }).guest_id) {
      await setAppToken(token);
      setLoginToken('');
    } else {
      setLoginError('Geçersiz giriş kodu. Check-in sonrası personelden aldığınız kodu girin.');
    }
    setLoginLoading(false);
  };

  if (appToken === null && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Mesajlaşma</Text>
          <Text style={styles.loginSubtitle}>
            Check-in sonrası personelden aldığınız giriş kodunu girin; otel personeli ve yönetimle mesajlaşabilirsiniz.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Giriş kodu"
            placeholderTextColor={MESSAGING_COLORS.textSecondary}
            value={loginToken}
            onChangeText={(t) => { setLoginToken(t); setLoginError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
          <TouchableOpacity style={styles.loginBtn} onPress={handleLoginWithToken} disabled={loginLoading}>
            {loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Giriş yap</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={MESSAGING_COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.newChatBtn} onPress={() => router.push('/customer/new-chat')}>
        <Text style={styles.newChatBtnText}>+ Yeni sohbet</Text>
      </TouchableOpacity>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadConversations} colors={[MESSAGING_COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Henüz sohbet yok.</Text>
            <Text style={styles.emptySub}>Personel veya yönetimle sohbet başlatmak için "Yeni sohbet"e tıklayın.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push({ pathname: '/customer/chat/[id]', params: { id: item.id } })}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(item.name || 'Sohbet').charAt(0)}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.name || 'Sohbet'}</Text>
              <Text style={styles.rowPreview} numberOfLines={1}>{item.last_message_preview || '—'}</Text>
            </View>
            <Text style={styles.rowTime}>{formatTime(item.last_message_at ?? null)}</Text>
            {(item.unread_count ?? 0) > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.unread_count}</Text></View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MESSAGING_COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loginCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  loginTitle: { fontSize: 20, fontWeight: '700', color: MESSAGING_COLORS.text, marginBottom: 8 },
  loginSubtitle: { fontSize: 14, color: MESSAGING_COLORS.textSecondary, marginBottom: 16, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  errorText: { color: MESSAGING_COLORS.error, fontSize: 13, marginBottom: 8 },
  loginBtn: {
    backgroundColor: MESSAGING_COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  newChatBtn: {
    backgroundColor: MESSAGING_COLORS.primary,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  newChatBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MESSAGING_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  rowBody: { flex: 1 },
  rowTitle: { fontWeight: '600', fontSize: 16, color: MESSAGING_COLORS.text },
  rowPreview: { fontSize: 14, color: MESSAGING_COLORS.textSecondary, marginTop: 2 },
  rowTime: { fontSize: 12, color: MESSAGING_COLORS.textSecondary },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: MESSAGING_COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, color: MESSAGING_COLORS.textSecondary },
  emptySub: { fontSize: 14, color: MESSAGING_COLORS.textSecondary, marginTop: 8 },
});
