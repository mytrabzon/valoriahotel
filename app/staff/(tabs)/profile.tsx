import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { uriToArrayBuffer } from '@/lib/uploadMedia';
import { theme } from '@/constants/theme';
import { CachedImage } from '@/components/CachedImage';
import { AvatarWithBadge } from '@/components/VerifiedBadge';
import { formatDateShort } from '@/lib/date';
import { notifyAdmins } from '@/lib/notificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STAFF_COVER_BLOCK_HEIGHT = 240;
const STAFF_AVATAR_SIZE_STYLE = 112;

type StaffProfile = {
  id: string;
  full_name: string | null;
  department: string | null;
  profile_image: string | null;
  cover_image: string | null;
  bio: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  is_online: boolean | null;
  total_reviews: number | null;
  average_rating: number | null;
  position: string | null;
  hire_date: string | null;
  office_location: string | null;
  achievements: string[] | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  show_phone_to_guest: boolean | null;
  show_email_to_guest: boolean | null;
  show_whatsapp_to_guest: boolean | null;
  verification_badge?: 'blue' | 'yellow' | null;
  shift?: { start_time: string; end_time: string } | null;
};

type ReviewRow = { id: string; rating: number; comment: string | null; created_at: string };

type SalaryPaymentRow = {
  id: string;
  period_month: number;
  period_year: number;
  amount: number;
  payment_date: string;
  status: string;
  staff_approved_at: string | null;
  staff_rejected_at: string | null;
  rejection_reason: string | null;
};

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function fmtMoney(n: number): string {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' ₺';
}

const actionButtons = [
  { key: 'sohbet', label: 'Sohbet', icon: 'chatbubbles' as const, route: '/staff/messages' },
  { key: 'gorevlerim', label: 'Görevlerim', icon: 'checkbox' as const, route: '/staff/tasks' },
  { key: 'paylasim', label: 'Paylaşım', icon: 'share-social' as const, route: '/staff/feed/new' },
  { key: 'stok', label: 'Stok', icon: 'cube' as const, route: '/staff/stock' },
];

export default function StaffProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { staff: authStaff, signOut } = useAuthStore();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [imageViewVisible, setImageViewVisible] = useState(false);
  const [coverImageViewVisible, setCoverImageViewVisible] = useState(false);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPaymentRow[]>([]);
  const [salaryActingId, setSalaryActingId] = useState<string | null>(null);
  const [salaryHistoryOpen, setSalaryHistoryOpen] = useState(false);
  const profileRef = useRef<StaffProfile | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!authStaff?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from('staff')
        .select(
          'id, full_name, department, profile_image, cover_image, bio, specialties, languages, is_online, total_reviews, average_rating, position, hire_date, office_location, achievements, phone, email, whatsapp, show_phone_to_guest, show_email_to_guest, show_whatsapp_to_guest, verification_badge, shift_id'
        )
        .eq('id', authStaff.id)
        .single();
      if (data) {
        setProfile({ ...data, shift: null } as StaffProfile);
        if (data.shift_id) {
          const { data: shift } = await supabase.from('shifts').select('start_time, end_time').eq('id', data.shift_id).single();
          setProfile((p) => (p ? { ...p, shift } : null));
        }
      }
      const { data: r } = await supabase
        .from('staff_reviews')
        .select('id, rating, comment, created_at')
        .eq('staff_id', authStaff.id)
        .order('created_at', { ascending: false });
      setReviews((r ?? []) as ReviewRow[]);
      const { data: sal } = await supabase
        .from('salary_payments')
        .select('id, period_month, period_year, amount, payment_date, status, staff_approved_at, staff_rejected_at, rejection_reason')
        .eq('staff_id', authStaff.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      setSalaryPayments((sal ?? []) as SalaryPaymentRow[]);
    };
    load();
  }, [authStaff?.id]);

  const pickImage = async () => {
    if (!profile) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin', 'Galeri erişimi gerekli.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      setUploading(true);
      const arrayBuffer = await uriToArrayBuffer(result.assets[0].uri);
      const fileName = `staff/${profile.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('profiles').upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(fileName);
      await supabase.from('staff').update({ profile_image: publicUrl }).eq('id', profile.id);
      setProfile((p) => (p ? { ...p, profile_image: publicUrl } : null));
    } catch (e) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Resim yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const onAvatarPress = () => {
    const uri = profile?.profile_image || undefined;
    if (uri) {
      setImageViewVisible(true);
    } else {
      pickImage();
    }
  };

  const pickCoverImage = async () => {
    if (!profile) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin', 'Galeri erişimi gerekli.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      setUploadingCover(true);
      const arrayBuffer = await uriToArrayBuffer(result.assets[0].uri);
      const fileName = `staff/${profile.id}/cover_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('profiles').upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(fileName);
      await supabase.from('staff').update({ cover_image: publicUrl }).eq('id', profile.id);
      setProfile((p) => (p ? { ...p, cover_image: publicUrl } : null));
    } catch (e) {
      Alert.alert('Hata', (e as Error)?.message ?? 'Kapak resmi yüklenemedi.');
    } finally {
      setUploadingCover(false);
    }
  };

  const updateOnline = async (value: boolean) => {
    if (!profile) return;
    const { error } = await supabase
      .from('staff')
      .update({ is_online: value, last_active: new Date().toISOString() })
      .eq('id', profile.id);
    if (error) {
      Alert.alert('Hata', 'Durum güncellenemedi. Lütfen tekrar deneyin.');
      return;
    }
    setProfile((p) => (p ? { ...p, is_online: value } : null));
  };

  const saveField = async (
    field: 'bio' | 'specialties' | 'languages' | 'office_location' | 'achievements' | 'phone' | 'email' | 'whatsapp',
    value: string | string[] | null
  ) => {
    if (!profile) return;
    let payload: Record<string, unknown>;
    if (field === 'specialties' || field === 'languages') {
      payload = { [field]: Array.isArray(value) ? value : value ? (value as string).split(',').map((s) => s.trim()).filter(Boolean) : [] };
    } else if (field === 'achievements') {
      payload = { [field]: Array.isArray(value) ? value : value ? (value as string).split(',').map((s) => s.trim()).filter(Boolean) : [] };
    } else if (field === 'email') {
      const trimmed = (value ?? '').toString().trim();
      // staff.email NOT NULL: boş bırakılırsa mevcut değeri koru
      payload = { email: trimmed || profile.email || '' };
    } else {
      payload = { [field]: value ?? null };
    }
    const { error } = await supabase.from('staff').update(payload).eq('id', profile.id);
    if (error) {
      Alert.alert('Kayıt hatası', `${field} kaydedilemedi: ${error.message}`);
      return;
    }
    setProfile((p) => (p ? { ...p, ...payload } : null));
  };

  const saveVisibility = async (field: 'show_phone_to_guest' | 'show_email_to_guest' | 'show_whatsapp_to_guest', value: boolean) => {
    if (!profile) return;
    const { error } = await supabase.from('staff').update({ [field]: value }).eq('id', profile.id);
    if (error) {
      Alert.alert('Kayıt hatası', `Görünürlük ayarı kaydedilemedi: ${error.message}`);
      return;
    }
    setProfile((p) => (p ? { ...p, [field]: value } : null));
  };

  const approveSalary = async (paymentId: string) => {
    setSalaryActingId(paymentId);
    const { error } = await supabase
      .from('salary_payments')
      .update({ status: 'approved', staff_approved_at: new Date().toISOString(), staff_rejected_at: null, rejection_reason: null })
      .eq('id', paymentId)
      .eq('staff_id', profile?.id);
    setSalaryActingId(null);
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    setSalaryPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: 'approved', staff_approved_at: new Date().toISOString(), staff_rejected_at: null, rejection_reason: null } : p))
    );
    const paid = salaryPayments.find((x) => x.id === paymentId);
    if (paid) {
      notifyAdmins({
        title: 'Maaş onayı',
        body: `${profile?.full_name ?? 'Personel'} maaşını onayladı. Dönem: ${MONTH_NAMES[paid.period_month - 1]} ${paid.period_year} – ${fmtMoney(Number(paid.amount))}`,
        data: { screen: '/admin/salary' },
      }).catch(() => {});
    }
  };

  const rejectSalary = (paymentId: string) => {
    Alert.alert(
      'Reddet (İtiraz)',
      'Maaş ödemesini reddedeceksiniz. Admin bilgilendirilecek.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Reddet',
          style: 'destructive',
          onPress: async () => {
            setSalaryActingId(paymentId);
            const { error } = await supabase
              .from('salary_payments')
              .update({ status: 'rejected', staff_rejected_at: new Date().toISOString(), staff_approved_at: null, rejection_reason: null })
              .eq('id', paymentId)
              .eq('staff_id', profile?.id);
            setSalaryActingId(null);
            if (error) {
              Alert.alert('Hata', error.message);
              return;
            }
            setSalaryPayments((prev) =>
              prev.map((p) => (p.id === paymentId ? { ...p, status: 'rejected', staff_rejected_at: new Date().toISOString(), staff_approved_at: null, rejection_reason: null } : p))
            );
            const paid = salaryPayments.find((x) => x.id === paymentId);
            if (paid) {
              notifyAdmins({
                title: 'Maaş reddedildi',
                body: `${profile?.full_name ?? 'Personel'} maaşını reddetti. Dönem: ${MONTH_NAMES[paid.period_month - 1]} ${paid.period_year} – ${fmtMoney(Number(paid.amount))}`,
                data: { screen: '/admin/salary' },
              }).catch(() => {});
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      t('signOut'),
      t('signOutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('signOut'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ]
    );
  };

  // Sayfadan çıkarken iletişim bilgilerini kaydet (onBlur atlanmış olabilir)
  useFocusEffect(
    useCallback(() => {
      return () => {
        const p = profileRef.current;
        if (!p?.id) return;
        const emailVal = p.email?.trim();
        supabase
          .from('staff')
          .update({
            phone: p.phone?.trim() || null,
            email: emailVal || p.email || '',
            whatsapp: p.whatsapp?.trim() || null,
          })
          .eq('id', p.id);
      };
    }, [])
  );

  if (!profile) {
    return (
      <View style={styles.centered}><Text>Yükleniyor...</Text></View>
    );
  }

  const avatarUri = profile.profile_image || 'https://via.placeholder.com/120';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        {/* Kapak sabit yükseklikte kutu; profil resmi kapak alt kenarına sabit, hep aynı yerde. */}
        <View style={[styles.coverBlock, styles.coverBlockFixed]}>
          <View style={styles.coverImageClip}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (uploadingCover) return;
                if (profile.cover_image) setCoverImageViewVisible(true);
                else pickCoverImage();
              }}
              activeOpacity={1}
            >
              {profile.cover_image ? (
                <CachedImage uri={profile.cover_image} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="image-outline" size={40} color={theme.colors.textMuted} />
                  <Text style={styles.coverPlaceholderText}>Kapak fotoğrafı yükle</Text>
                </View>
              )}
            </TouchableOpacity>
            {uploadingCover && (
              <View style={styles.coverUploadOverlay}>
                <Text style={styles.uploadText}>Yükleniyor</Text>
              </View>
            )}
            {!uploadingCover && (
              <TouchableOpacity style={styles.coverEditBtn} onPress={pickCoverImage} activeOpacity={0.9}>
                <Ionicons name="camera" size={20} color={theme.colors.white} />
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.avatarOnCover, { bottom: -STAFF_AVATAR_SIZE_STYLE / 2 + 55 }]}>
            <TouchableOpacity onPress={onAvatarPress} disabled={uploading} activeOpacity={0.9} style={styles.avatarTouchWrap}>
              <AvatarWithBadge badge={profile.verification_badge ?? null} avatarSize={120} badgeSize={20}>
                <CachedImage uri={avatarUri} style={styles.avatar} contentFit="cover" />
              </AvatarWithBadge>
              {uploading && (
                <View style={styles.uploadOverlay}>
                  <Text style={styles.uploadText}>Yükleniyor</Text>
                </View>
              )}
              <TouchableOpacity style={styles.editPhotoBtn} onPress={(e) => { e.stopPropagation(); pickImage(); }} disabled={uploading}>
                <Ionicons name="camera" size={18} color={theme.colors.white} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.body, { paddingTop: STAFF_AVATAR_SIZE_STYLE / 2 + 16 }]}>
          <Text style={styles.name}>{profile.full_name || '—'}</Text>

          {/* İş bilgileri – tek kart: Departman, İşe başlama, Konum, Durum */}
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>📊 İş bilgileri</Text>
          </View>
          <View style={styles.jobInfoCard}>
            <View style={styles.jobInfoRow}>
              <Text style={styles.jobInfoItem}>📌 {profile.department?.trim() || 'Belirtilmemiş'}</Text>
              <Text style={styles.jobInfoItem}>📅 {profile.hire_date ? new Date(profile.hire_date).toLocaleDateString('tr-TR') : 'Belirtilmemiş'}</Text>
            </View>
            <View style={[styles.jobInfoRow, styles.jobInfoRowLast]}>
              <Text style={styles.jobInfoItem}>📍 {profile.office_location?.trim() || 'Belirtilmemiş'}</Text>
              <View style={styles.jobInfoStatus}>
                <View style={[styles.onlineDot, profile.is_online && styles.onlineDotOn]} />
                <Text style={styles.onlineLabel}>{profile.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}</Text>
                <Switch
                  value={profile.is_online ?? false}
                  onValueChange={updateOnline}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.primary }}
                  thumbColor={theme.colors.surface}
                />
              </View>
            </View>
          </View>

          {/* Maaş bilgileri */}
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>💰 Maaş bilgileri</Text>
          </View>
          <View style={styles.card}>
            {salaryPayments.length === 0 ? (
              <Text style={styles.salaryMuted}>Henüz maaş kaydı yok.</Text>
            ) : (
              <>
                <View style={styles.salaryRow}>
                  <Text style={styles.label}>Son ödenen maaş</Text>
                  <Text style={styles.salaryAmount}>{fmtMoney(Number(salaryPayments[0].amount))}</Text>
                </View>
                <Text style={styles.salaryDetail}>Ödeme tarihi: {formatDateShort(salaryPayments[0].payment_date)}</Text>
                <Text style={styles.salaryDetail}>
                  Durum: {salaryPayments[0].status === 'approved' ? `✅ Onaylandı (${salaryPayments[0].staff_approved_at ? formatDateShort(salaryPayments[0].staff_approved_at) : '—'})` : salaryPayments[0].status === 'rejected' ? '❌ Reddedildi' : '⏳ Onay bekliyor'}
                </Text>
                <TouchableOpacity style={styles.salaryHistoryToggle} onPress={() => setSalaryHistoryOpen((v) => !v)}>
                  <Text style={styles.salaryHistoryToggleText}>📜 Maaş geçmişi</Text>
                  <Ionicons name={salaryHistoryOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.primary} />
                </TouchableOpacity>
                {salaryHistoryOpen && (
                  <View style={styles.salaryHistoryList}>
                    {salaryPayments.slice(0, 12).map((p) => (
                      <View key={p.id} style={styles.salaryHistoryItem}>
                        <Text style={styles.salaryHistoryText}>{MONTH_NAMES[p.period_month - 1]} {p.period_year}: {fmtMoney(Number(p.amount))} – {formatDateShort(p.payment_date)} {p.status === 'approved' ? '✅' : p.status === 'rejected' ? '❌' : '⏳'}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
          {salaryPayments.some((p) => p.status === 'pending_approval') && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>⏳ Onay bekleyen maaş</Text>
              {salaryPayments
                .filter((p) => p.status === 'pending_approval')
                .map((p) => (
                  <View key={p.id} style={styles.pendingSalaryBlock}>
                    <Text style={styles.pendingSalaryText}>🔔 Maaşınız yatırıldı: {fmtMoney(Number(p.amount))} ({formatDateShort(p.payment_date)})</Text>
                    <Text style={styles.pendingSalaryHint}>Lütfen kontrol edip onaylayın.</Text>
                    <View style={styles.pendingSalaryActions}>
                      <TouchableOpacity
                        style={[styles.pendingSalaryBtn, styles.pendingSalaryBtnApprove]}
                        onPress={() => approveSalary(p.id)}
                        disabled={salaryActingId === p.id}
                      >
                        {salaryActingId === p.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="checkmark" size={18} color="#fff" />
                            <Text style={styles.pendingSalaryBtnText}>Onayla</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.pendingSalaryBtn, styles.pendingSalaryBtnReject]}
                        onPress={() => rejectSalary(p.id)}
                        disabled={salaryActingId === p.id}
                      >
                        <Ionicons name="close" size={18} color="#fff" />
                        <Text style={styles.pendingSalaryBtnText}>Reddet (İtiraz)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
            </View>
          )}

          {/* Hızlı erişim – modern kartlar */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Hızlı erişim</Text>
            <View style={styles.actionsGrid}>
              {actionButtons.map((btn) => (
                <TouchableOpacity
                  key={btn.key}
                  style={styles.actionCard}
                  onPress={() => router.push(btn.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons name={btn.icon} size={28} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.actionLabel} numberOfLines={1}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Performans özeti */}
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>📊 Performans özeti</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.total_reviews ?? 0}</Text>
              <Text style={styles.statLabel}>Değerlendirme</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{(profile.average_rating ?? 0).toFixed(1)}</Text>
              <Text style={styles.statLabel}>Puan</Text>
            </View>
          </View>
          {profile.shift && (
            <View style={styles.shiftBox}>
              <Text style={styles.label}>Çalışma saatleri</Text>
              <Text style={styles.shiftText}>{profile.shift.start_time} – {profile.shift.end_time}</Text>
            </View>
          )}

          {/* Kişisel bilgiler + görünürlük */}
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>📋 Kişisel bilgiler</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Konum / Ofis</Text>
            <TextInput
              style={styles.input}
              value={profile.office_location ?? ''}
              onChangeText={(t) => setProfile((p) => (p ? { ...p, office_location: t || null } : null))}
              onBlur={() => saveField('office_location', profile.office_location ?? '')}
              placeholder="Örn: 2. Kat Ofisi"
              placeholderTextColor={theme.colors.textMuted}
            />
            <Text style={styles.label}>Telefon</Text>
            <TextInput
              style={styles.input}
              value={profile.phone ?? ''}
              onChangeText={(t) => setProfile((p) => (p ? { ...p, phone: t || null } : null))}
              onBlur={() => saveField('phone', profile.phone ?? '')}
              placeholder="0555 123 45 67"
              keyboardType="phone-pad"
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Müşteriye telefon göster</Text>
              <Switch
                value={profile.show_phone_to_guest !== false}
                onValueChange={(v) => saveVisibility('show_phone_to_guest', v)}
                trackColor={{ true: theme.colors.primary }}
              />
            </View>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              value={profile.email ?? ''}
              onChangeText={(t) => setProfile((p) => (p ? { ...p, email: t || null } : null))}
              onBlur={() => saveField('email', profile.email ?? '')}
              placeholder="ornek@valoria.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Müşteriye e-posta göster</Text>
              <Switch
                value={profile.show_email_to_guest !== false}
                onValueChange={(v) => saveVisibility('show_email_to_guest', v)}
                trackColor={{ true: theme.colors.primary }}
              />
            </View>
            <Text style={styles.label}>WhatsApp</Text>
            <TextInput
              style={styles.input}
              value={profile.whatsapp ?? ''}
              onChangeText={(t) => setProfile((p) => (p ? { ...p, whatsapp: t || null } : null))}
              onBlur={() => saveField('whatsapp', profile.whatsapp ?? '')}
              placeholder="05551234567"
              keyboardType="phone-pad"
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Müşteriye WhatsApp göster</Text>
              <Switch
                value={profile.show_whatsapp_to_guest !== false}
                onValueChange={(v) => saveVisibility('show_whatsapp_to_guest', v)}
                trackColor={{ true: theme.colors.primary }}
              />
            </View>
          </View>

          {/* Bilgilerim */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Bilgilerim</Text>
            <Text style={styles.label}>Biyografi</Text>
            <TextInput
              style={styles.input}
              value={profile.bio ?? ''}
              onChangeText={(t) => setProfile((p) => (p ? { ...p, bio: t } : null))}
              onBlur={() => saveField('bio', profile.bio ?? '')}
              placeholder="Belirtilmemiş"
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
            <Text style={styles.label}>Uzmanlıklar (virgülle)</Text>
            <TextInput
              style={styles.input}
              value={profile.specialties?.join(', ') ?? ''}
              onChangeText={(t) => setProfile((p) => (p ? { ...p, specialties: t ? t.split(',').map((s) => s.trim()).filter(Boolean) : [] } : null))}
              onBlur={() => saveField('specialties', profile.specialties?.join(', ') ?? '')}
              placeholder="Belirtilmemiş"
              placeholderTextColor={theme.colors.textMuted}
            />
            <Text style={styles.label}>Diller</Text>
            <TextInput
              style={styles.input}
              value={profile.languages?.join(', ') ?? ''}
              onChangeText={(t) => setProfile((p) => (p ? { ...p, languages: t ? t.split(',').map((s) => s.trim()).filter(Boolean) : [] } : null))}
              onBlur={() => saveField('languages', profile.languages?.join(', ') ?? '')}
              placeholder="Belirtilmemiş"
              placeholderTextColor={theme.colors.textMuted}
            />
            <Text style={styles.label}>Başarılar (virgülle)</Text>
            <TextInput
              style={styles.input}
              value={profile.achievements?.join(', ') ?? ''}
              onChangeText={(t) => setProfile((p) => (p ? { ...p, achievements: t ? t.split(',').map((s) => s.trim()).filter(Boolean) : [] } : null))}
              onBlur={() => saveField('achievements', profile.achievements?.join(', ') ?? '')}
              placeholder="Belirtilmemiş"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>🛡️ İzinler & Yasal</Text>
          </View>
          <TouchableOpacity
            style={[styles.card, styles.linkRow]}
            onPress={() => router.push('/permissions')}
            activeOpacity={0.8}
          >
            <Text style={styles.linkRowText}>Uygulama izinleri (kamera, konum, bildirim vb.)</Text>
            <Text style={styles.mutedRow}>→</Text>
          </TouchableOpacity>

          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>🗑️ Hesap yönetimi</Text>
          </View>
          <TouchableOpacity
            style={[styles.card, styles.signOutButton]}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutButtonText}>{t('signOut')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, styles.deleteAccountRow]}
            onPress={() => router.push('/staff/delete-account')}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteAccountText}>Hesabımı sil</Text>
            <Text style={styles.mutedRow}>→</Text>
          </TouchableOpacity>

          {reviews.length > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={styles.sectionTitle}>💬 Değerlendirmeler ({reviews.length})</Text>
              {reviews.slice(0, 15).map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}</Text>
                  {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                </View>
              ))}
              {reviews.length > 15 && (
                <Text style={styles.mutedRow}>+{reviews.length - 15} değerlendirme daha</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Tam ekran profil resmi – boşluğa tıklayınca kapanır */}
      <Modal
        visible={imageViewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewVisible(false)}
      >
        <Pressable style={styles.imageModalOverlay} onPress={() => setImageViewVisible(false)}>
          <Pressable style={styles.imageModalContent} onPress={() => {}}>
            <CachedImage uri={avatarUri} style={styles.imageModalImage} contentFit="contain" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tam ekran kapak resmi */}
      <Modal
        visible={coverImageViewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCoverImageViewVisible(false)}
      >
        <Pressable style={styles.imageModalOverlay} onPress={() => setCoverImageViewVisible(false)}>
          <Pressable style={styles.imageModalContent} onPress={() => {}}>
            {profile.cover_image ? (
              <CachedImage uri={profile.cover_image} style={styles.imageModalImage} contentFit="contain" />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  coverBlock: {
    width: SCREEN_WIDTH,
    position: 'relative',
    overflow: 'visible',
    alignSelf: 'stretch',
  },
  coverBlockFixed: {
    height: STAFF_COVER_BLOCK_HEIGHT,
  },
  coverImageClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: STAFF_COVER_BLOCK_HEIGHT,
    overflow: 'hidden',
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  coverPlaceholderText: { color: theme.colors.textMuted, fontSize: 14 },
  coverUploadOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverEditBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOnCover: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  avatarTouchWrap: { position: 'relative' },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: theme.colors.surface,
    backgroundColor: theme.colors.borderLight,
    ...theme.shadows.md,
    shadowOpacity: 0.2,
    elevation: 6,
  },
  uploadOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: { color: theme.colors.white, fontSize: 12 },
  editPhotoBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  body: { padding: theme.spacing.lg, paddingTop: theme.spacing.md },
  name: { ...theme.typography.title, color: theme.colors.text, textAlign: 'center' },
  dept: { fontSize: 15, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' },
  position: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2, textAlign: 'center' },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  onlineLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.textMuted },
  onlineDotOn: { backgroundColor: theme.colors.success },
  onlineLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  jobInfoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  jobInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  jobInfoRowLast: { marginBottom: 0 },
  jobInfoItem: { fontSize: 14, color: theme.colors.text, flex: 1, minWidth: 0 },
  jobInfoStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    ...theme.typography.bodySmall,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  actionsSection: { marginTop: theme.spacing.sm },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (SCREEN_WIDTH - theme.spacing.lg * 2 - 12) / 2,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  infoSection: { marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: 14,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    ...theme.shadows.sm,
  },
  sectionTitleWrap: { marginTop: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkRowText: { fontSize: 15, color: theme.colors.text, flex: 1 },
  signOutButton: {
    marginBottom: 12,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.error,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  signOutButtonText: { fontSize: 16, fontWeight: '600', color: theme.colors.error },
  deleteAccountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteAccountText: { fontSize: 15, color: theme.colors.error, fontWeight: '600' },
  mutedRow: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  switchLabel: { fontSize: 14, color: theme.colors.text, flex: 1 },
  shiftBox: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    ...theme.shadows.sm,
  },
  shiftText: { fontSize: 14, color: theme.colors.text },
  reviewsSection: { marginTop: theme.spacing.xl },
  reviewCard: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  reviewStars: { color: theme.colors.primary, marginBottom: 4 },
  reviewComment: { fontSize: 14, color: theme.colors.text },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    ...theme.shadows.sm,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: theme.colors.primary },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: SCREEN_WIDTH,
    maxHeight: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    borderRadius: 0,
  },
  salaryMuted: { fontSize: 14, color: theme.colors.textMuted },
  salaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  salaryAmount: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  salaryDetail: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 },
  salaryHistoryToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.borderLight },
  salaryHistoryToggleText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  salaryHistoryList: { marginTop: 8, gap: 6 },
  salaryHistoryItem: { paddingVertical: 4 },
  salaryHistoryText: { fontSize: 13, color: theme.colors.textSecondary },
  pendingSalaryBlock: { marginTop: 8, padding: 12, backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.radius.md },
  pendingSalaryText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  pendingSalaryHint: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  pendingSalaryActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  pendingSalaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.radius.md },
  pendingSalaryBtnApprove: { backgroundColor: theme.colors.success },
  pendingSalaryBtnReject: { backgroundColor: theme.colors.error },
  pendingSalaryBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.white },
});
