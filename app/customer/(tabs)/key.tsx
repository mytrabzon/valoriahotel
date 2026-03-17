import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { DesignableQR } from '@/components/DesignableQR';
import { BarcodeScannerView } from '@/components/BarcodeScannerView';

export default function DigitalKeyScreen() {
  const { user } = useAuthStore();
  const [roomNumber, setRoomNumber] = useState<string>('—');
  const [checkIn, setCheckIn] = useState<string>('—');
  const [checkOut, setCheckOut] = useState<string>('—');
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [showScan, setShowScan] = useState(false);

  const guestName = useMemo(() => {
    const n = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
    if (n && typeof n === 'string' && n.trim()) return n.trim();
    const email = user?.email ?? '';
    const part = email.split('@')[0];
    return part ? part.charAt(0).toUpperCase() + part.slice(1) : 'Misafir';
  }, [user?.email, user?.user_metadata?.full_name, user?.user_metadata?.name]);

  useEffect(() => {
    (async () => {
      if (!user?.email) return;
      const { data: guest } = await supabase
        .from('guests')
        .select('room_id, check_in_at, check_out_at')
        .eq('email', user.email)
        .eq('status', 'checked_in')
        .order('check_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!guest?.room_id) return;

      const { data: room } = await supabase.from('rooms').select('room_number').eq('id', guest.room_id).maybeSingle();
      if (room?.room_number) setRoomNumber(String(room.room_number));
      if (guest.check_in_at) setCheckIn(new Date(guest.check_in_at).toLocaleDateString('tr-TR'));
      if (guest.check_out_at) setCheckOut(new Date(guest.check_out_at).toLocaleDateString('tr-TR'));

      const { data: qr } = await supabase
        .from('room_qr_codes')
        .select('token')
        .eq('room_id', guest.room_id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setRoomToken(qr?.token ?? null);
    })();
  }, [user?.email]);

  const urls = useMemo(() => {
    if (!roomToken) return { checkinUrl: null, contractUrl: null };
    const appBase = process.env.EXPO_PUBLIC_APP_URL ?? 'https://valoria.app';
    const checkinUrl = `${appBase}/guest?token=${encodeURIComponent(roomToken)}`;
    const contractBase =
      process.env.EXPO_PUBLIC_PUBLIC_CONTRACT_URL ??
      `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/public-contract`;
    return { checkinUrl, contractUrl: `${contractBase}?t=${encodeURIComponent(roomToken)}&l=tr` };
  }, [roomToken]);

  const isValid = !!roomToken;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hotelName}>Valoria Hotel</Text>
      <Text style={styles.welcome}>Hoş geldiniz, {guestName}</Text>
      <View style={styles.infoBox}>
        <Text style={styles.infoLine}>Oda: {roomNumber}</Text>
        <Text style={styles.infoLine}>Giriş: {checkIn}</Text>
        <Text style={styles.infoLine}>Çıkış: {checkOut}</Text>
      </View>

      <View style={[styles.card, !isValid && styles.cardDisabled]}>
        <Text style={styles.cardTitle}>Dijital Anahtar</Text>
        <Text style={styles.note}>
          NFC şu an devre dışı. Dijital anahtar için Bluetooth/QR akışı kullanılacak.
        </Text>
        <Text style={styles.cardHint}>🔵 Bluetooth ile otomatik aç (yaklaşınca)</Text>
        <Text style={styles.or}>veya</Text>
        <Text style={styles.cardHint}>📸 QR Kod göster (kapı okutur)</Text>
        {!isValid && (
          <Text style={styles.invalidHint}>
            Check-in yaptıktan sonra dijital anahtarınız aktif olacaktır.
          </Text>
        )}
      </View>

      {isValid && urls.checkinUrl && (
        <View style={styles.qrSection}>
          <Text style={styles.sectionTitle}>QR Kodlar</Text>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Odaya giriş (Check-in)</Text>
            <DesignableQR
              value={urls.checkinUrl}
              size={190}
              design={{ useLogo: true, backgroundColor: '#ffffff', foregroundColor: '#111827', shape: 'rounded', logoSizeRatio: 0.22 }}
            />
          </View>
          {urls.contractUrl && (
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>Otel kuralları / sözleşme onayı</Text>
              <DesignableQR
                value={urls.contractUrl}
                size={190}
                design={{ useLogo: true, backgroundColor: '#ffffff', foregroundColor: '#1a365d', shape: 'dots', logoSizeRatio: 0.22 }}
              />
              <Text style={styles.qrSub}>Bu QR uygulama indirmeden web’de açılır ve onay kaydeder.</Text>
            </View>
          )}
          <TouchableOpacity style={styles.scanBtn} onPress={() => setShowScan(true)} activeOpacity={0.85}>
            <Text style={styles.scanBtnText}>QR Tara</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Açabileceğiniz kapılar</Text>
      <Text style={styles.doorsList}>Oda kapınız, otopark, havuz, spor salonu</Text>

      <View style={styles.shareRow}>
        <TouchableOpacity style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>Anahtarı paylaş</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showScan} animationType="slide" onRequestClose={() => setShowScan(false)}>
        <BarcodeScannerView
          title="QR Tara"
          hint="QR kodu çerçeve içine getirin"
          onClose={() => setShowScan(false)}
          onScan={({ data }) => {
            const s = String(data || '').trim();
            if (!s) return;
            setShowScan(false);
            if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('valoria://') || s.startsWith('exp+')) {
              Linking.openURL(s).catch(() => Alert.alert('Hata', 'Link açılamadı.'));
            } else {
              Alert.alert('Okundu', s);
            }
          }}
        />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  content: { padding: 24, paddingBottom: 48 },
  hotelName: { fontSize: 20, fontWeight: '700', color: '#1a202c', marginBottom: 4 },
  welcome: { fontSize: 16, color: '#4a5568', marginBottom: 16 },
  infoBox: { backgroundColor: '#edf2f7', padding: 16, borderRadius: 12, marginBottom: 24 },
  infoLine: { fontSize: 14, color: '#2d3748', marginBottom: 4 },
  card: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  cardDisabled: { opacity: 0.8 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1a202c', marginBottom: 16, textAlign: 'center' },
  note: { fontSize: 14, color: '#718096', textAlign: 'center', marginBottom: 12 },
  cardHint: { fontSize: 15, color: '#4a5568', textAlign: 'center', marginVertical: 4 },
  or: { fontSize: 14, color: '#a0aec0', textAlign: 'center', marginVertical: 8 },
  invalidHint: { fontSize: 13, color: '#e53e3e', textAlign: 'center', marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#2d3748', marginBottom: 8 },
  doorsList: { fontSize: 14, color: '#718096', marginBottom: 24 },
  shareRow: { flexDirection: 'row', justifyContent: 'center' },
  shareBtn: { backgroundColor: '#b8860b', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  shareBtnText: { color: '#fff', fontWeight: '600' },
  qrSection: { marginBottom: 26 },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 12, textAlign: 'center' },
  qrSub: { marginTop: 10, fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 18 },
  scanBtn: { backgroundColor: '#1a365d', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  scanBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
