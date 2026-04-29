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
  Linking,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { theme } from '@/constants/theme';
import { useTranslation } from 'react-i18next';
import { EmergencyConsulatesModal } from '@/components/EmergencyConsulatesModal';

const SITUATION_IDS = ['unwell', 'water', 'fire', 'domestic', 'other'] as const;
export type EmergencySituationId = (typeof SITUATION_IDS)[number];

export default function EmergencyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [roomNumber, setRoomNumber] = useState('');
  const [sending, setSending] = useState(false);
  const [situation, setSituation] = useState<EmergencySituationId | null>(null);
  const [consulatesOpen, setConsulatesOpen] = useState(false);

  const situationLabel = situation ? t(`emergencySituation_${situation}`) : '';

  const openTel112 = async () => {
    try {
      const ok = await Linking.canOpenURL('tel:112');
      if (ok) await Linking.openURL('tel:112');
      else Alert.alert(t('error'), t('couldNotOpen'));
    } catch {
      Alert.alert(t('error'), t('couldNotOpen'));
    }
  };

  const handlePanic = async () => {
    const trimmedRoom = (roomNumber ?? '').trim();
    if (!situation) {
      Alert.alert(t('emergencySituationRequiredTitle'), t('emergencySituationRequiredBody'));
      return;
    }
    if (!trimmedRoom) {
      Alert.alert(t('emergencyRoomRequiredTitle'), t('emergencyRoomRequiredBody'));
      return;
    }
    Alert.alert(
      t('emergencyTitle'),
      t('emergencyConfirmMessage', { room: trimmedRoom, situation: situationLabel }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('emergencySendYes'),
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
                p_situation: situationLabel,
              });

              if (error) {
                Alert.alert(t('error'), t('emergencyNotifyFailed') + ': ' + error.message);
                return;
              }
              const { notifyAdmins } = await import('@/lib/notificationService');
              await notifyAdmins({
                title: t('emergencyNotifyAdminTitle'),
                body: t('emergencyNotifyAdminBody', {
                  name: guestDisplayName,
                  room: trimmedRoom,
                  situation: situationLabel,
                }),
                data: { url: '/admin/notifications/emergency', category: 'emergency' },
              });
              Alert.alert(t('emergencySentTitle'), t('emergencySentBody'));
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
        <Text style={styles.title}>🆘 {t('emergencyTitle')}</Text>
        <Text style={styles.hotelBlockTitle}>{t('emergencySectionHotelHelp')}</Text>
        <Text style={styles.desc}>{t('emergencyScreenDescription')}</Text>
        <Text style={styles.label}>{t('emergencySituationSectionTitle')}</Text>
        <View style={styles.situationWrap}>
          {SITUATION_IDS.map((id) => {
            const active = situation === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.situationChip, active && styles.situationChipActive]}
                onPress={() => setSituation(id)}
                disabled={sending}
                activeOpacity={0.85}
              >
                <Text style={[styles.situationChipText, active && styles.situationChipTextActive]}>
                  {t(`emergencySituation_${id}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.label}>{t('emergencyRoomLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('emergencyRoomPlaceholder')}
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
          <Text style={styles.panicText}>{sending ? t('emergencySending') : t('emergencySubmitCta')}</Text>
        </TouchableOpacity>
        <Text style={styles.nationalSectionTitle}>{t('emergencySectionNational')}</Text>
        <View style={styles.nationalCard}>
          <Text style={styles.nationalKicker}>🚨 {t('emergencyNational112CardTitle')}</Text>
          <Pressable
            onPress={openTel112}
            style={({ pressed }) => [styles.telBlock, pressed && styles.telBlockPressed]}
          >
            <Text style={styles.telEmoji}>📞</Text>
            <Text style={styles.telNumber}>112</Text>
            <Text style={styles.telHint}>{t('emergency112TapToCall')}</Text>
          </Pressable>
          <Text style={styles.nationalBody}>{t('emergencyNational112Hint')}</Text>
          <View style={styles.serviceList}>
            <Text style={styles.serviceLine}>🚑 {t('emergency112ServicesAmbulance')}</Text>
            <Text style={styles.serviceLine}>🚓 {t('emergency112ServicesPolice')}</Text>
            <Text style={styles.serviceLine}>🚒 {t('emergency112ServicesFire')}</Text>
            <Text style={styles.serviceLine}>{t('emergency112ServicesGendarmerie')}</Text>
            <Text style={styles.serviceLine}>{t('emergency112ServicesAfad')}</Text>
          </View>
          <Text style={styles.nationalNote}>{t('emergency112Disclaimer')}</Text>
        </View>

        <TouchableOpacity
          style={styles.consulatesButton}
          onPress={() => setConsulatesOpen(true)}
          activeOpacity={0.88}
        >
          <Text style={styles.consulatesButtonText}>🌍 {t('emergencyConsulatesButton')}</Text>
        </TouchableOpacity>
      </ScrollView>
      <EmergencyConsulatesModal visible={consulatesOpen} onClose={() => setConsulatesOpen(false)} />
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
  hotelBlockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  desc: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  situationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  situationChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  situationChipActive: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error + '14',
  },
  situationChipText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  situationChipTextActive: { fontWeight: '600', color: theme.colors.error },
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
  nationalSectionTitle: {
    marginTop: theme.spacing.xl,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  nationalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  nationalKicker: { fontSize: 16, fontWeight: '700', color: theme.colors.text, textAlign: 'center', marginBottom: 12 },
  telBlock: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.backgroundSecondary,
    marginBottom: 12,
  },
  telBlockPressed: { opacity: 0.88 },
  telEmoji: { fontSize: 22, marginBottom: 4 },
  telNumber: { fontSize: 34, fontWeight: '800', color: theme.colors.primary, letterSpacing: 1 },
  telHint: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  nationalBody: { fontSize: 15, color: theme.colors.text, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  serviceList: { gap: 6, marginBottom: 12 },
  serviceLine: { fontSize: 14, color: theme.colors.text, lineHeight: 22 },
  nationalNote: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, textAlign: 'center' },
  consulatesButton: {
    marginTop: theme.spacing.lg,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  consulatesButtonText: { fontSize: 15, fontWeight: '700', color: theme.colors.primary, textAlign: 'center' },
});
