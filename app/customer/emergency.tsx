import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { theme } from '@/constants/theme';

export default function EmergencyScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [roomNumber, setRoomNumber] = useState('');
  const [sending, setSending] = useState(false);

  const handlePanic = async () => {
    const trimmedRoom = (roomNumber ?? '').trim();
    if (!trimmedRoom) {
      Alert.alert('Eksik bilgi', 'Lütfen oda numaranızı yazın.');
      return;
    }
    Alert.alert(
      'Acil durum',
      `Oda ${trimmedRoom} için acil yardım bildirimi gönderilecek. Onaylıyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, gönder',
          style: 'destructive',
          onPress: async () => {
            setSending(true);
            try {
              let guestId: string | null = null;
              let guestName: string | null = null;

              if (user?.email) {
                const { data: guest } = await supabase
                  .from('guests')
                  .select('id, full_name')
                  .eq('email', user.email)
                  .eq('status', 'checked_in')
                  .order('check_in_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (guest) {
                  const g = guest as { id: string; full_name: string | null };
                  guestId = g.id;
                  guestName = g.full_name;
                }
              }

              const guestDisplayName = guestName ?? (user?.user_metadata?.full_name ?? user?.email ?? 'Misafir');
              const { error } = await supabase.rpc('create_emergency_alert', {
                p_guest_id: guestId ?? null,
                p_room_number: trimmedRoom,
                p_guest_name: guestDisplayName,
              });

              if (error) {
                Alert.alert('Hata', 'Bildirim gönderilemedi: ' + error.message);
                return;
              }
              const body = `Misafir acil yardım istiyor. Misafir: ${guestDisplayName} · Oda: ${trimmedRoom}`;
              const { notifyAdmins } = await import('@/lib/notificationService');
              await notifyAdmins({
                title: '🆘 Acil durum',
                body,
                data: { url: '/admin/notifications/emergency', category: 'emergency' },
              });
              Alert.alert(
                'Gönderildi',
                'Acil durum bildiriminiz yönetime iletildi. Yardım yolda olacaktır.'
              );
              router.back();
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>🆘 Acil durum</Text>
        <Text style={styles.desc}>
          Acil yardıma ihtiyacınız varsa oda numaranızı yazıp onaylayın. Güvenlik ve yönetim anında bilgilendirilir.
        </Text>
        <Text style={styles.label}>Oda numarası</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: 101"
          placeholderTextColor={theme.colors.textMuted}
          value={roomNumber}
          onChangeText={setRoomNumber}
          keyboardType="number-pad"
          maxLength={10}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.panicButton, sending && styles.panicButtonDisabled]}
          onPress={handlePanic}
          disabled={sending}
        >
          <Text style={styles.panicText}>{sending ? 'Gönderiliyor...' : 'Oda no ile onayla ve gönder'}</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>
          Polis: 155 • Ambulans: 112 • Yangın: 110
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  scrollContent: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl + 24,
  },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: 8, textAlign: 'center' },
  desc: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
  panicButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: theme.radius.md,
    minWidth: 260,
    alignSelf: 'center',
    alignItems: 'center',
  },
  panicButtonDisabled: { opacity: 0.7 },
  panicText: { fontSize: 16, fontWeight: '700', color: theme.colors.white },
  footer: { marginTop: theme.spacing.xxl, fontSize: 14, color: theme.colors.textMuted, textAlign: 'center' },
});
