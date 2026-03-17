import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { DesignableQR, type QRDesign } from '@/components/DesignableQR';

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
      const contractBase =
        settingsMap.contract_qr_base_url ||
        (process.env.EXPO_PUBLIC_PUBLIC_CONTRACT_URL ??
          `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/public-contract`);

      const { data: qr } = await supabase.from('room_qr_codes').select('token').eq('room_id', id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (qr?.token) {
        const isAppScheme = checkinBase === 'valoria://' || checkinBase === 'valoria' || checkinBase.startsWith('valoria://');
        setQrValue(isAppScheme ? `valoria://guest?token=${encodeURIComponent(qr.token)}` : `${checkinBase.replace(/\/$/, '')}/guest?token=${encodeURIComponent(qr.token)}`);
        const { data: rev } = await supabase.rpc('get_contract_public_revision');
        const revParam = rev ? `&rev=${encodeURIComponent(String(rev))}` : '';
        setContractQrValue(`${contractBase}?t=${encodeURIComponent(qr.token)}&l=tr${revParam}`);
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
    const contractBase =
      settingsMap.contract_qr_base_url ||
      (process.env.EXPO_PUBLIC_PUBLIC_CONTRACT_URL ??
        `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/public-contract`);
    const { data: rev } = await supabase.rpc('get_contract_public_revision');
    const revParam = rev ? `&rev=${encodeURIComponent(String(rev))}` : '';
    setContractQrValue(`${contractBase}?t=${encodeURIComponent(String(data))}&l=tr${revParam}`);
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
              <DesignableQR value={qrValue} size={180} design={roomDesign} />
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
              />
            )}
            <Text style={styles.qrRoom}>Valoria Hotel • Oda {room.room_number}</Text>
            <TouchableOpacity style={styles.qrBtn} onPress={refreshQR}>
              <Text style={styles.qrBtnText}>QR Kodu Yenile</Text>
            </TouchableOpacity>
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
              <DesignableQR value={contractQrValue} size={180} design={roomDesign} />
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
              />
            )}
            <Text style={styles.qrRoom}>Kurallar/Sözleşme • Oda {room.room_number}</Text>
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
  qrBtn: { marginTop: 12, padding: 12, backgroundColor: '#ed8936', borderRadius: 8, alignSelf: 'center' },
  qrBtnText: { color: '#fff', fontWeight: '600' },
});
