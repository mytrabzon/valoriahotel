import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { DesignableQR, type QRDesign, type QRCodeRef } from '@/components/DesignableQR';
import { FIXED_CONTRACT_QR_URL } from '@/constants/contractQr';

type Room = {
  id: string;
  room_number: string;
  floor: number | null;
  status: string;
  view_type: string | null;
  area_sqm: number | null;
  bed_type: string | null;
  price_per_night: number | null;
};

type Template = {
  id: string;
  use_logo: boolean;
  background_color: string;
  foreground_color: string;
  shape: 'square' | 'rounded' | 'dots' | 'circle';
  logo_size_ratio: number;
};
type SettingsRow = {
  template_id: string | null;
  use_logo_override: boolean | null;
  background_color_override: string | null;
  foreground_color_override: string | null;
  shape_override: string | null;
  template: Template | null;
};

function resolveRoomDesign(settings: SettingsRow | null): QRDesign | null {
  if (!settings?.template) return null;
  const t = settings.template;
  return {
    useLogo: settings.use_logo_override ?? t.use_logo,
    backgroundColor: settings.background_color_override ?? t.background_color,
    foregroundColor: settings.foreground_color_override ?? t.foreground_color,
    shape: (settings.shape_override as QRDesign['shape']) ?? t.shape,
    logoSizeRatio: Number(t.logo_size_ratio) || 0.24,
  };
}

export default function RoomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [qrValue, setQrValue] = useState<string>('');
  const [contractQrValue, setContractQrValue] = useState<string>('');
  const [roomDesign, setRoomDesign] = useState<QRDesign | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkinQrRef, setCheckinQrRef] = useState<QRCodeRef>(null);
  const [contractQrRef, setContractQrRef] = useState<QRCodeRef>(null);
  const [qrDownloading, setQrDownloading] = useState<'checkin' | 'contract' | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('rooms').select('*').eq('id', id).single();
      setRoom(data ?? null);
      const { data: appSettings } = await supabase.from('app_settings').select('key, value').in('key', ['checkin_qr_base_url', 'contract_qr_base_url']);
      const settingsMap: Record<string, string> = {};
      (appSettings ?? []).forEach((r: { key: string; value: unknown }) => {
        const v = r.value;
        if (v != null && String(v).trim()) settingsMap[r.key] = String(v).trim();
      });
      const checkinBaseRaw = settingsMap.checkin_qr_base_url || process.env.EXPO_PUBLIC_APP_URL || '';
      const checkinBase = checkinBaseRaw.trim() || 'valoria://';

      const { data: qr } = await supabase.from('room_qr_codes').select('token').eq('room_id', id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (qr?.token) {
        const isAppScheme = checkinBase === 'valoria://' || checkinBase === 'valoria' || checkinBase.startsWith('valoria://');
        setQrValue(isAppScheme ? `valoria://guest?token=${encodeURIComponent(qr.token)}` : `${checkinBase.replace(/\/$/, '')}/guest?token=${encodeURIComponent(qr.token)}`);
        setContractQrValue(FIXED_CONTRACT_QR_URL);
      }

      const { data: settings } = await supabase
        .from('qr_design_settings')
        .select('template_id, use_logo_override, background_color_override, foreground_color_override, shape_override')
        .eq('scope', 'room')
        .single();
      if (settings?.template_id) {
        const { data: template } = await supabase
          .from('qr_design_templates')
          .select('id, use_logo, background_color, foreground_color, shape, logo_size_ratio')
          .eq('id', settings.template_id)
          .single();
        setRoomDesign(resolveRoomDesign(settings ? { ...settings, template: template ?? null } : null));
      } else {
        setRoomDesign(null);
      }
      setLoading(false);
    })();
  }, [id]);

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

  const refreshQR = async () => {
    if (!id) return;
    const { data, error } = await supabase.rpc('generate_room_qr_token', { p_room_id: id });
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    const { data: appSettings } = await supabase.from('app_settings').select('key, value').in('key', ['checkin_qr_base_url', 'contract_qr_base_url']);
    const settingsMap: Record<string, string> = {};
    (appSettings ?? []).forEach((r: { key: string; value: unknown }) => {
      const v = r.value;
      if (v != null && String(v).trim()) settingsMap[r.key] = String(v).trim();
    });
    const checkinBaseRaw = settingsMap.checkin_qr_base_url || process.env.EXPO_PUBLIC_APP_URL || '';
    const checkinBase = checkinBaseRaw.trim() || 'valoria://';
    const isAppScheme = checkinBase === 'valoria://' || checkinBase === 'valoria' || checkinBase.startsWith('valoria://');
    setQrValue(isAppScheme ? `valoria://guest?token=${encodeURIComponent(String(data))}` : `${checkinBase.replace(/\/$/, '')}/guest?token=${encodeURIComponent(String(data))}`);
    setContractQrValue(FIXED_CONTRACT_QR_URL);
  };

  if (loading || !room) return <Text style={styles.loading}>Yükleniyor...</Text>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Oda {room.room_number}</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Durum</Text>
        <Text style={styles.value}>{room.status}</Text>
      </View>
      {room.floor != null && (
        <View style={styles.section}>
          <Text style={styles.label}>Kat</Text>
          <Text style={styles.value}>{room.floor}</Text>
        </View>
      )}
      {room.view_type && (
        <View style={styles.section}>
          <Text style={styles.label}>Manzara</Text>
          <Text style={styles.value}>{room.view_type}</Text>
        </View>
      )}
      {room.bed_type && (
        <View style={styles.section}>
          <Text style={styles.label}>Yatak</Text>
          <Text style={styles.value}>{room.bed_type}</Text>
        </View>
      )}
      {room.price_per_night != null && (
        <View style={styles.section}>
          <Text style={styles.label}>Gece fiyatı</Text>
          <Text style={styles.value}>₺{room.price_per_night}</Text>
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.label}>QR Kod</Text>
        {qrValue ? (
          <View style={styles.qrWrap}>
            {roomDesign ? (
              <DesignableQR value={qrValue} size={180} design={roomDesign} getRef={setCheckinQrRef} />
            ) : (
              <DesignableQR
                value={qrValue}
                size={180}
                design={{
                  useLogo: true,
                  backgroundColor: '#FFFFFF',
                  foregroundColor: '#000000',
                  shape: 'square',
                  logoSizeRatio: 0.22,
                }}
                getRef={setCheckinQrRef}
              />
            )}
            <Text style={styles.qrRoom}>Valoria Hotel • Oda {room.room_number}</Text>
            <View style={styles.qrActions}>
              <TouchableOpacity style={styles.qrBtn} onPress={refreshQR}>
                <Text style={styles.qrBtnText}>QR Kodu Yenile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qrDownloadBtn, qrDownloading === 'checkin' && styles.qrBtnDisabled]}
                onPress={() => startDownloadQr('checkin')}
                disabled={qrDownloading !== null}
              >
                <Text style={styles.qrBtnText}>QR İndir</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.qrBtn} onPress={refreshQR}>
            <Text style={styles.qrBtnText}>QR Kod Oluştur</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Sözleşme Onay QR (Uygulamasız Web)</Text>
        {contractQrValue ? (
          <View style={styles.qrWrap}>
            {roomDesign ? (
              <DesignableQR value={contractQrValue} size={180} design={roomDesign} getRef={setContractQrRef} />
            ) : (
              <DesignableQR
                value={contractQrValue}
                size={180}
                design={{
                  useLogo: true,
                  backgroundColor: '#FFFFFF',
                  foregroundColor: '#1a365d',
                  shape: 'rounded',
                  logoSizeRatio: 0.22,
                }}
                getRef={setContractQrRef}
              />
            )}
            <Text style={styles.qrRoom}>Kurallar/Sözleşme • Oda {room.room_number}</Text>
            <TouchableOpacity
              style={[styles.qrDownloadBtn, qrDownloading === 'contract' && styles.qrBtnDisabled]}
              onPress={() => startDownloadQr('contract')}
              disabled={qrDownloading !== null}
            >
              <Text style={styles.qrBtnText}>Sözleşme QR İndir</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.value}>Önce oda QR token oluşturun / yenileyin.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  content: { padding: 24 },
  loading: { padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a202c', marginBottom: 24 },
  section: { marginBottom: 20 },
  label: { fontSize: 12, color: '#718096', marginBottom: 4 },
  value: { fontSize: 16, color: '#1a202c', fontWeight: '500' },
  qrWrap: { alignItems: 'center', marginTop: 8 },
  qrRoom: { marginTop: 8, fontSize: 16, fontWeight: '600', color: '#1a202c' },
  qrActions: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  qrBtn: { padding: 12, backgroundColor: '#ed8936', borderRadius: 8 },
  qrDownloadBtn: { padding: 12, backgroundColor: '#2d3748', borderRadius: 8 },
  qrBtnDisabled: { opacity: 0.7 },
  qrBtnText: { color: '#fff', fontWeight: '600' },
});
