import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, TextInput, ActivityIndicator, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { DesignableQR, type QRCodeRef } from '@/components/DesignableQR';
import { BarcodeScannerView } from '@/components/BarcodeScannerView';

export default function DigitalKeyScreen() {
  const { user } = useAuthStore();
  const [roomNumber, setRoomNumber] = useState<string>('—');
  const [checkIn, setCheckIn] = useState<string>('—');
  const [checkOut, setCheckOut] = useState<string>('—');
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [showScan, setShowScan] = useState(false);
  const [doorRoomInput, setDoorRoomInput] = useState('');
  const [openDoorLoading, setOpenDoorLoading] = useState(false);
  const [checkinQrRef, setCheckinQrRef] = useState<QRCodeRef>(null);
  const [contractQrRef, setContractQrRef] = useState<QRCodeRef>(null);
  const [qrDownloading, setQrDownloading] = useState<'checkin' | 'contract' | null>(null);

  const guestName = useMemo(() => {
    const n = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
    if (n && typeof n === 'string' && n.trim()) return n.trim();
    const email = user?.email ?? '';
    const part = email.split('@')[0];
    return part ? part.charAt(0).toUpperCase() + part.slice(1) : 'Misafir';
  }, [user?.email, user?.user_metadata?.full_name, user?.user_metadata?.name]);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      let guest: { room_id: string; check_in_at: string | null; check_out_at: string | null } | null = null;
      if (user.email) {
        const { data } = await supabase
          .from('guests')
          .select('room_id, check_in_at, check_out_at')
          .eq('email', user.email)
          .eq('status', 'checked_in')
          .order('check_in_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        guest = data as typeof guest;
      }
      if (!guest) {
        const { data } = await supabase
          .from('guests')
          .select('room_id, check_in_at, check_out_at')
          .eq('auth_user_id', user.id)
          .eq('status', 'checked_in')
          .order('check_in_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        guest = data as typeof guest;
      }
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
  }, [user?.id, user?.email]);

  const urls = useMemo(() => {
    if (!roomToken) return { checkinUrl: null, contractUrl: null };
    const defaultAppBase = 'https://valoriahotel-el4r.vercel.app';
    const appBase = (process.env.EXPO_PUBLIC_APP_URL ?? defaultAppBase).replace(/\/$/, '');
    const checkinUrl = `${appBase}/guest?token=${encodeURIComponent(roomToken)}`;
    const defaultContractBase = 'https://valoriahotel-el4r.vercel.app/guest/sign-one';
    let contractBase =
      process.env.EXPO_PUBLIC_PUBLIC_CONTRACT_URL ??
      (process.env.EXPO_PUBLIC_SUPABASE_URL ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/public-contract` : null) ??
      defaultContractBase;
    if (contractBase.includes('valoria.app')) contractBase = defaultContractBase;
    const base = String(contractBase).replace(/\?.*$/, '').replace(/\/$/, '');
    return { checkinUrl, contractUrl: `${base}?t=${encodeURIComponent(roomToken)}&l=tr` };
  }, [roomToken]);

  const isValid = !!roomToken;

  const downloadQrAsImage = useCallback(async (ref: QRCodeRef, label: string) => {
    if (!ref?.toDataURL) {
      if (Platform.OS === 'web') Alert.alert('Bilgi', 'Web\'de QR indirmek için sağ tıklayıp "Resmi farklı kaydet" kullanın.');
      return;
    }
    ref.toDataURL(async (data: string) => {
      try {
        const base64 = data.startsWith('data:') ? data.replace(/^data:image\/\w+;base64,/, '') : data;
        const filename = `valoria-qr-${label}-${Date.now()}.png`;
        const path = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: `QR Kod – ${label}` });
        else Alert.alert('Kaydedildi', path);
      } catch (e) {
        Alert.alert('Hata', (e as Error)?.message ?? 'QR indirilemedi.');
      }
      setQrDownloading(null);
    });
  }, []);

  const startDownloadQr = (which: 'checkin' | 'contract') => {
    const ref = which === 'checkin' ? checkinQrRef : contractQrRef;
    if (!ref?.toDataURL) {
      if (Platform.OS === 'web') Alert.alert('Bilgi', 'Web\'de QR indirmek için QR görseline sağ tıklayıp "Resmi farklı kaydet" kullanın.');
      return;
    }
    setQrDownloading(which);
    downloadQrAsImage(ref, which === 'checkin' ? 'checkin' : 'sozlesme');
  };

  const openDoor = async () => {
    const num = doorRoomInput.trim() || (roomNumber !== '—' ? roomNumber : '');
    if (!num) {
      Alert.alert('Oda numarası girin', 'Açmak istediğiniz kapının oda numarasını yazın (örn. 101).');
      return;
    }
    setOpenDoorLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('open-door', {
        body: { room_number: num },
      });
      if (error) throw error;
      const result = data?.result ?? data?.success ? 'granted' : 'denied';
      const message = (data?.message as string) || (result === 'granted' ? 'Kapı açıldı.' : 'Yetkiniz yok.');
      if (result === 'granted') {
        Alert.alert('Başarılı', message);
      } else {
        Alert.alert('Açılamadı', message);
      }
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Kapı açma isteği gönderilemedi.');
    }
    setOpenDoorLoading(false);
  };

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
          Telefonla kapı açma: oda numarasını yazıp "Kapıyı aç" butonuna basın. Check-in yapmış olmalısınız.
        </Text>
        {!isValid && (
          <Text style={styles.invalidHint}>
            Check-in yaptıktan sonra dijital anahtarınız aktif olacaktır.
          </Text>
        )}
      </View>

      {isValid && (
        <View style={styles.openDoorCard}>
          <Text style={styles.sectionTitle}>Kapıyı aç</Text>
          <Text style={styles.openDoorHint}>Oda numarasını girin (kapıda yazan numara)</Text>
          <TextInput
            style={styles.doorInput}
            value={doorRoomInput}
            onChangeText={setDoorRoomInput}
            placeholder={roomNumber !== '—' ? roomNumber : '101'}
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            maxLength={10}
          />
          <TouchableOpacity
            style={[styles.openDoorBtn, openDoorLoading && styles.openDoorBtnDisabled]}
            onPress={openDoor}
            disabled={openDoorLoading}
          >
            {openDoorLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.openDoorBtnText}>Kapıyı aç</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isValid && urls.checkinUrl && (
        <View style={styles.qrSection}>
          <Text style={styles.sectionTitle}>QR Kodlar</Text>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Odaya giriş (Check-in)</Text>
            <DesignableQR
              value={urls.checkinUrl}
              size={190}
              design={{ useLogo: true, backgroundColor: '#ffffff', foregroundColor: '#111827', shape: 'rounded', logoSizeRatio: 0.22 }}
              getRef={setCheckinQrRef}
            />
            <TouchableOpacity
              style={[styles.qrDownloadBtn, qrDownloading === 'checkin' && styles.qrDownloadBtnDisabled]}
              onPress={() => startDownloadQr('checkin')}
              disabled={qrDownloading !== null}
            >
              <Text style={styles.qrDownloadBtnText}>QR İndir</Text>
            </TouchableOpacity>
          </View>
          {urls.contractUrl && (
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>Otel kuralları / sözleşme onayı</Text>
              <DesignableQR
                value={urls.contractUrl}
                size={190}
                design={{ useLogo: true, backgroundColor: '#ffffff', foregroundColor: '#1a365d', shape: 'dots', logoSizeRatio: 0.22 }}
                getRef={setContractQrRef}
              />
              <Text style={styles.qrSub}>Bu QR uygulama indirmeden web’de açılır ve onay kaydeder.</Text>
              <TouchableOpacity
                style={[styles.qrDownloadBtn, qrDownloading === 'contract' && styles.qrDownloadBtnDisabled]}
                onPress={() => startDownloadQr('contract')}
                disabled={qrDownloading !== null}
              >
                <Text style={styles.qrDownloadBtnText}>QR İndir</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.scanBtn} onPress={() => setShowScan(true)} activeOpacity={0.85}>
            <Text style={styles.scanBtnText}>QR Tara</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Açabileceğiniz kapılar</Text>
      <Text style={styles.doorsList}>Oda kapınız (check-in sonrası). Ek yetkiler Admin → Kart Tanımlama ile verilir.</Text>

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
  qrDownloadBtn: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#2d3748', borderRadius: 10, alignSelf: 'center' },
  qrDownloadBtnDisabled: { opacity: 0.7 },
  qrDownloadBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  scanBtn: { backgroundColor: '#1a365d', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  scanBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  openDoorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  openDoorHint: { fontSize: 13, color: '#718096', marginBottom: 10 },
  doorInput: {
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    color: '#1a202c',
    marginBottom: 14,
  },
  openDoorBtn: { backgroundColor: '#059669', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  openDoorBtnDisabled: { opacity: 0.7 },
  openDoorBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
