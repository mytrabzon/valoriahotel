import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
let NfcManager: typeof import('react-native-nfc-manager').default;
let NfcTech: typeof import('react-native-nfc-manager').NfcTech;
if (isNative) {
  const Nfc = require('react-native-nfc-manager');
  NfcManager = Nfc.default;
  NfcTech = Nfc.NfcTech;
}

export default function DigitalKeyScreen() {
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [nfcEnabled, setNfcEnabled] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [lastTag, setLastTag] = useState<string | null>(null);

  const guestName = 'Misafir';
  const roomNumber = '—';
  const checkIn = '—';
  const checkOut = '—';
  const isValid = false;

  useEffect(() => {
    if (!isNative || !NfcManager) {
      setNfcSupported(false);
      return;
    }
    let isMounted = true;
    async function initNfc() {
      try {
        const supported = await NfcManager.isSupported();
        if (!isMounted) return;
        setNfcSupported(supported);
        if (supported) {
          await NfcManager.start();
          if (Platform.OS === 'android') {
            const enabled = await NfcManager.isEnabled();
            if (isMounted) setNfcEnabled(enabled);
          } else {
            setNfcEnabled(true);
          }
        }
      } catch {
        if (isMounted) setNfcSupported(false);
      }
    }
    initNfc();
    return () => {
      isMounted = false;
      NfcManager?.cancelTechnologyRequest?.().catch(() => {});
    };
  }, []);

  const readNfcTag = useCallback(async () => {
    if (!isNative || !NfcManager || !NfcTech) return;
    if (!nfcSupported || nfcEnabled === false) {
      Alert.alert(
        'NFC Kullanılamıyor',
        nfcSupported === false
          ? 'Bu cihaz NFC desteklemiyor.'
          : 'Lütfen NFC\'yi ayarlardan açın.'
      );
      return;
    }
    setListening(true);
    setLastTag(null);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      if (tag?.id) {
        setLastTag(tag.id);
        // İleride: bu tag id veya NDEF payload ile backend'e istek atıp kapı açtırılabilir
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message?.includes('cancelled') || err?.message?.includes('cancel')) {
        // Kullanıcı iptal etti
      } else {
        setLastTag(null);
      }
    } finally {
      setListening(false);
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }, [nfcSupported, nfcEnabled]);

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

        {nfcSupported === true && (
          <>
            <TouchableOpacity
              style={[styles.nfcButton, listening && styles.nfcButtonActive]}
              onPress={readNfcTag}
              disabled={listening}
            >
              <Text style={styles.nfcButtonText}>
                {listening ? '📱 Kapı okuyucusuna yaklaştırın...' : '📱 NFC ile kapıyı aç'}
              </Text>
            </TouchableOpacity>
            {lastTag ? (
              <Text style={styles.tagOk}>Etiket okundu (ID: {lastTag.slice(0, 12)}…)</Text>
            ) : null}
            <Text style={styles.or}>veya</Text>
          </>
        )}
        {nfcSupported === false && (
          <Text style={styles.nfcUnsupported}>Bu cihazda NFC bulunmuyor.</Text>
        )}
        {nfcSupported === true && nfcEnabled === false && Platform.OS === 'android' && (
          <Text style={styles.nfcUnsupported}>NFC kapalı. Ayarlardan açın.</Text>
        )}

        <Text style={styles.cardHint}>🔵 Bluetooth ile otomatik aç (yaklaşınca)</Text>
        <Text style={styles.or}>veya</Text>
        <Text style={styles.cardHint}>📸 QR Kod göster (kapı okutur)</Text>
        {!isValid && (
          <Text style={styles.invalidHint}>
            Check-in yaptıktan sonra dijital anahtarınız aktif olacaktır.
          </Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Açabileceğiniz kapılar</Text>
      <Text style={styles.doorsList}>Oda kapınız, otopark, havuz, spor salonu</Text>

      <View style={styles.shareRow}>
        <TouchableOpacity style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>Anahtarı paylaş</Text>
        </TouchableOpacity>
      </View>
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
  cardHint: { fontSize: 15, color: '#4a5568', textAlign: 'center', marginVertical: 4 },
  or: { fontSize: 14, color: '#a0aec0', textAlign: 'center', marginVertical: 8 },
  invalidHint: { fontSize: 13, color: '#e53e3e', textAlign: 'center', marginTop: 16 },
  nfcButton: {
    backgroundColor: '#b8860b',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  nfcButtonActive: { backgroundColor: '#8b6914' },
  nfcButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  tagOk: { fontSize: 13, color: '#38a169', textAlign: 'center', marginBottom: 8 },
  nfcUnsupported: { fontSize: 14, color: '#718096', textAlign: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#2d3748', marginBottom: 8 },
  doorsList: { fontSize: 14, color: '#718096', marginBottom: 24 },
  shareRow: { flexDirection: 'row', justifyContent: 'center' },
  shareBtn: { backgroundColor: '#b8860b', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  shareBtnText: { color: '#fff', fontWeight: '600' },
});
