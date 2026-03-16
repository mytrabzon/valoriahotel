import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { sendNotification } from '@/lib/notificationService';
import { GUEST_TYPES, GUEST_MESSAGE_TEMPLATES } from '@/lib/notifications';
import { formatDateTime } from '@/lib/date';

type ContractTemplate = { title: string; content: string } | null;
type Guest = {
  id: string;
  full_name: string;
  id_number: string | null;
  id_type: string | null;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  status: string;
  room_id: string | null;
  rooms: { room_number: string } | null;
  created_at: string;
  verified_at: string | null;
  admin_notes: string | null;
  signature_data: string | null;
  contract_lang: string;
  contract_templates: ContractTemplate;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildContractHtml(guest: Guest): string {
  const name = escapeHtml(guest.full_name);
  const phone = guest.phone ? escapeHtml(guest.phone) : '—';
  const email = guest.email ? escapeHtml(guest.email) : '—';
  const idNo = guest.id_number ? escapeHtml(guest.id_number) : '—';
  const room = guest.rooms?.room_number ? escapeHtml(String(guest.rooms.room_number)) : '—';
  const date = formatDateTime(guest.verified_at ?? guest.created_at);
  const title = guest.contract_templates?.title
    ? escapeHtml(guest.contract_templates.title)
    : 'Konaklama Sözleşmesi';
  const content = guest.contract_templates?.content
    ? escapeHtml(guest.contract_templates.content).replace(/\n/g, '<br/>')
    : '';
  const sigImg = guest.signature_data
    ? `<img src="${guest.signature_data}" alt="İmza" style="max-width:280px;height:auto;margin-top:16px;" />`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #1a202c; font-size: 14px; line-height: 1.5; }
    h1 { font-size: 18px; margin-bottom: 16px; color: #1a365d; }
    .info { background: #f7fafc; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .info p { margin: 4px 0; }
    .contract { white-space: pre-wrap; margin: 16px 0; }
    .signature { margin-top: 24px; }
  </style>
</head>
<body>
  <h1>VALORIA HOTEL – ${title}</h1>
  <div class="info">
    <p><strong>Misafir:</strong> ${name}</p>
    <p><strong>Telefon:</strong> ${phone}</p>
    <p><strong>E-posta:</strong> ${email}</p>
    <p><strong>Kimlik No:</strong> ${idNo}</p>
    <p><strong>Oda:</strong> ${room}</p>
    <p><strong>Onay Tarihi:</strong> ${date}</p>
  </div>
  <div class="contract">${content}</div>
  <div class="signature">
    <p><strong>Dijital imza:</strong></p>
    ${sigImg}
  </div>
</body>
</html>`;
}

export default function GuestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { staff } = useAuthStore();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [rooms, setRooms] = useState<{ id: string; room_number: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: g } = await supabase
        .from('guests')
        .select('*, rooms(room_number), contract_templates(title, content)')
        .eq('id', id)
        .single();
      setGuest(g ?? null);
      const { data: r } = await supabase.from('rooms').select('id, room_number').eq('status', 'available');
      setRooms(r ?? []);
      setLoading(false);
    })();
  }, [id]);

  const exportPdf = async () => {
    if (!guest?.signature_data) {
      Alert.alert('Uyarı', 'Bu misafir henüz sözleşmeyi imzalamamış.');
      return;
    }
    setPdfLoading(true);
    try {
      const html = buildContractHtml(guest);
      const { uri } = await Print.printToFileAsync({
        html,
        width: 595,
        height: 842,
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Sözleşmeyi Kaydet' });
      } else {
        Alert.alert('PDF hazır', `Dosya: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Hata', (e as Error)?.message ?? 'PDF oluşturulamadı.');
    }
    setPdfLoading(false);
  };

  const assignRoom = async (roomId: string) => {
    if (!id) return;
    const roomNumber = rooms.find((r) => r.id === roomId)?.room_number;
    const { error } = await supabase.from('guests').update({ room_id: roomId, status: 'checked_in', check_in_at: new Date().toISOString() }).eq('id', id);
    if (error) Alert.alert('Hata', error.message);
    else {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', roomId);
      setGuest((prev) => prev ? { ...prev, room_id: roomId, status: 'checked_in' } : null);
      const msg = GUEST_MESSAGE_TEMPLATES[GUEST_TYPES.admin_assigned_room]({ roomNumber: roomNumber ?? '' });
      await sendNotification({
        guestId: id,
        title: msg.title,
        body: msg.body,
        notificationType: GUEST_TYPES.admin_assigned_room,
        category: 'guest',
        createdByStaffId: staff?.id ?? undefined,
      });
    }
  };

  const checkOut = async () => {
    if (!id || !guest?.room_id) return;
    const { error } = await supabase.from('guests').update({ status: 'checked_out', check_out_at: new Date().toISOString() }).eq('id', id);
    if (error) Alert.alert('Hata', error.message);
    else {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', guest.room_id);
      setGuest((prev) => prev ? { ...prev, status: 'checked_out', room_id: null } : null);
      const msg = GUEST_MESSAGE_TEMPLATES[GUEST_TYPES.checkout_done]({});
      await sendNotification({
        guestId: id,
        title: msg.title,
        body: msg.body,
        notificationType: GUEST_TYPES.checkout_done,
        category: 'guest',
        createdByStaffId: staff?.id ?? undefined,
      });
    }
  };

  if (loading || !guest) return <Text style={styles.loading}>Yükleniyor...</Text>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{guest.full_name}</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Durum</Text>
        <Text style={styles.value}>{guest.status}</Text>
      </View>
      {guest.phone && (
        <View style={styles.section}>
          <Text style={styles.label}>Telefon</Text>
          <Text style={styles.value}>{guest.phone}</Text>
        </View>
      )}
      {guest.email && (
        <View style={styles.section}>
          <Text style={styles.label}>E-posta</Text>
          <Text style={styles.value}>{guest.email}</Text>
        </View>
      )}
      {guest.id_number && (
        <View style={styles.section}>
          <Text style={styles.label}>Kimlik No</Text>
          <Text style={styles.value}>{guest.id_number}</Text>
        </View>
      )}
      {guest.rooms?.room_number && (
        <View style={styles.section}>
          <Text style={styles.label}>Oda</Text>
          <Text style={styles.value}>{guest.rooms.room_number}</Text>
        </View>
      )}
      {guest.admin_notes && (
        <View style={styles.section}>
          <Text style={styles.label}>Notlar</Text>
          <Text style={styles.value}>{guest.admin_notes}</Text>
        </View>
      )}
      {guest.signature_data && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.pdfBtn, pdfLoading && styles.pdfBtnDisabled]}
            onPress={exportPdf}
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.pdfBtnText}>Sözleşmeyi PDF Olarak Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      {guest.status === 'pending' && rooms.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Oda Ata</Text>
          {rooms.map((r) => (
            <TouchableOpacity key={r.id} style={styles.roomBtn} onPress={() => assignRoom(r.id)}>
              <Text style={styles.roomBtnText}>Oda {r.room_number}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {guest.status === 'checked_in' && guest.room_id && (
        <TouchableOpacity style={styles.checkOutBtn} onPress={checkOut}>
          <Text style={styles.checkOutBtnText}>Check-out</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  content: { padding: 24 },
  loading: { padding: 24 },
  name: { fontSize: 22, fontWeight: '700', color: '#1a202c', marginBottom: 24 },
  section: { marginBottom: 20 },
  label: { fontSize: 12, color: '#718096', marginBottom: 4 },
  value: { fontSize: 16, color: '#1a202c' },
  roomBtn: { marginTop: 8, padding: 12, backgroundColor: '#1a365d', borderRadius: 8, alignSelf: 'flex-start' },
  roomBtnText: { color: '#fff', fontWeight: '600' },
  pdfBtn: { marginTop: 8, padding: 16, backgroundColor: '#2d3748', borderRadius: 12, alignItems: 'center' },
  pdfBtnDisabled: { opacity: 0.7 },
  pdfBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  checkOutBtn: { marginTop: 24, padding: 16, backgroundColor: '#e53e3e', borderRadius: 12, alignItems: 'center' },
  checkOutBtnText: { color: '#fff', fontWeight: '600' },
});
