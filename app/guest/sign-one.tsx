import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuestFlowStore } from '@/stores/guestFlowStore';
import { useGuestMessagingStore } from '@/stores/guestMessagingStore';
import { supabase } from '@/lib/supabase';
import { COUNTRY_PHONE_CODES, type CountryCode } from '@/constants/countryPhoneCodes';

const ALLOWED_CONTRACT_LANGS = ['tr', 'en', 'ar', 'de', 'fr', 'ru', 'es'] as const;

function parseDDMMYYYY(s: string): string | null {
  const trimmed = (s || '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[./-]/).map((p) => parseInt(p, 10));
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  return date.toISOString().slice(0, 10) + 'T12:00:00.000Z';
}

function toISODate(s: string): string | null {
  const iso = parseDDMMYYYY(s);
  return iso ? iso.slice(0, 10) : null;
}

const ID_TYPES = [
  { value: 'tc', label: 'TC Kimlik' },
  { value: 'passport', label: 'Pasaport' },
  { value: 'other', label: 'Sürücü Belgesi' },
] as const;

const GENDERS = [
  { value: 'male', label: 'Erkek' },
  { value: 'female', label: 'Kadın' },
] as const;

const ROOM_TYPES = ['Tek kişilik', 'Çift kişilik', 'Üç kişilik', 'Aile', 'Suite', 'Diğer'];

export default function GuestSignOneScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ token?: string; lang?: string }>();
  const { qrToken, roomId, roomNumber, setQR, setStep, setGuestId } = useGuestFlowStore();
  const { setAppToken } = useGuestMessagingStore();

  const token = (params.token ?? qrToken ?? '').trim();
  const lang = (params.lang ?? i18n.language ?? 'tr').toLowerCase();

  const [contractContent, setContractContent] = useState('');
  const [loadingContract, setLoadingContract] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showNationalityPicker, setShowNationalityPicker] = useState(false);

  const [fullName, setFullName] = useState('');
  const [idType, setIdType] = useState<'tc' | 'passport' | 'other'>('tc');
  const [idNumber, setIdNumber] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(COUNTRY_PHONE_CODES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('Türkiye');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [address, setAddress] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [roomType, setRoomType] = useState('Çift kişilik');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const fetchContract = useCallback(async () => {
    setLoadingContract(true);
    const { data } = await supabase
      .from('contract_templates')
      .select('content')
      .eq('lang', lang)
      .eq('version', 2)
      .eq('is_active', true)
      .maybeSingle();
    if (!data) {
      const { data: fallback } = await supabase
        .from('contract_templates')
        .select('content')
        .eq('lang', lang)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      setContractContent(fallback?.content ?? '');
    } else {
      setContractContent(data.content ?? '');
    }
    setLoadingContract(false);
  }, [lang]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  useEffect(() => {
    if (token) {
      supabase
        .from('room_qr_codes')
        .select('room_id, rooms(room_number)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const r = data as { room_id?: string; rooms?: { room_number?: string } };
            setQR(token, r.room_id ?? '', r.rooms?.room_number ?? '');
          }
        });
    }
  }, [token, setQR]);

  const fullPhone = `${phoneCountry.dial} ${phoneNumber.trim()}`.trim();
  const signerSummary = [
    fullName && `Ad Soyad: ${fullName}`,
    idNumber && `Kimlik No: ${idNumber}`,
    fullPhone && `Telefon (WhatsApp): ${fullPhone}`,
    email && `E-posta: ${email}`,
    nationality && `Uyruk: ${nationality}`,
    dateOfBirth && `Doğum Tarihi: ${dateOfBirth}`,
    gender && `Cinsiyet: ${GENDERS.find((g) => g.value === gender)?.label ?? gender}`,
    address && `Adres: ${address}`,
    checkInDate && `Giriş: ${checkInDate}`,
    checkOutDate && `Çıkış: ${checkOutDate}`,
    roomType && `Oda Tipi: ${roomType}`,
    `Yetişkin: ${adults}`,
    `Çocuk: ${children}`,
  ].filter(Boolean);

  const submit = async () => {
    if (!fullName.trim()) {
      Alert.alert(t('error'), 'Ad Soyad zorunludur.');
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert(t('error'), 'WhatsApp / Telefon numarası zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const { data: template } = await supabase
        .from('contract_templates')
        .select('id')
        .eq('lang', lang)
        .eq('version', 2)
        .eq('is_active', true)
        .maybeSingle();

      const guestPayload = {
        full_name: fullName.trim(),
        id_number: idNumber.trim() || null,
        id_type: idType,
        phone: fullPhone || null,
        phone_country_code: phoneCountry.dial,
        email: email.trim() || null,
        nationality: nationality.trim() || null,
        contract_lang: lang,
        contract_template_id: template?.id ?? null,
        date_of_birth: toISODate(dateOfBirth) || null,
        gender: gender || null,
        address: address.trim() || null,
        room_id: roomId || null,
        check_in_at: parseDDMMYYYY(checkInDate) || null,
        check_out_at: parseDDMMYYYY(checkOutDate) || null,
        room_type: roomType || null,
        adults: adults ?? 1,
        children: children ?? 0,
        status: 'pending',
      };

      const { data: guest, error: guestErr } = await supabase
        .from('guests')
        .insert(guestPayload)
        .select('id')
        .single();

      if (guestErr) throw guestErr;
      if (guest) {
        setGuestId(guest.id);
        const { data: appToken } = await supabase.rpc('get_guest_app_token', { p_guest_id: guest.id });
        if (appToken) await setAppToken(appToken);
      }

      if (token) {
        await supabase.from('contract_acceptances').insert({
          token,
          room_id: roomId || null,
          contract_lang: lang,
          contract_version: 2,
          contract_template_id: template?.id ?? null,
          source: 'app',
        });
      }

      setStep('done');
      router.replace('/guest/success');
    } catch (e: unknown) {
      Alert.alert(t('error'), (e as Error)?.message ?? 'Kayıt oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const renderPickerModal = (title: string, items: CountryCode[] | string[], onSelect: (item: CountryCode | string) => void, onClose: () => void) => (
    <Modal visible={title.length > 0} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalDrawer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={items as CountryCode[]}
            keyExtractor={(item) => (typeof item === 'string' ? item : `${item.dial}-${item.code}`)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalRow}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.modalRowText}>
                  {typeof item === 'string' ? item : `${item.dial} ${item.name}`}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const headerH = 56 + insets.top;
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerH}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Sözleşme onayı</Text>
        <Text style={styles.sectionLabel}>1. ZORUNLU BİLGİLER</Text>

        <Text style={styles.fieldLabel}>Ad Soyad *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ahmet Yılmaz"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />

        <Text style={styles.fieldLabel}>Kimlik tipi</Text>
        <View style={styles.chipRow}>
          {ID_TYPES.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, idType === opt.value && styles.chipActive]}
              onPress={() => setIdType(opt.value)}
            >
              <Text style={[styles.chipText, idType === opt.value && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Kimlik numarası</Text>
        <TextInput
          style={styles.input}
          placeholder="TC veya pasaport no"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={idNumber}
          onChangeText={setIdNumber}
          keyboardType="default"
        />

        <Text style={styles.fieldLabel}>Telefon (WhatsApp) *</Text>
        <View style={styles.phoneRow}>
          <TouchableOpacity style={styles.countryBtn} onPress={() => setShowCountryPicker(true)}>
            <Text style={styles.countryBtnText}>{phoneCountry.dial}</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder="555 123 4567"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
        </View>

        <Text style={styles.fieldLabel}>E-posta</Text>
        <TextInput
          style={styles.input}
          placeholder="ahmet@email.com"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.fieldLabel}>Uyruk</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowNationalityPicker(true)}>
          <Text style={styles.inputText}>{nationality || 'Seçin'}</Text>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Doğum tarihi</Text>
        <TextInput
          style={styles.input}
          placeholder="GG.AA.YYYY"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.fieldLabel}>Cinsiyet</Text>
        <View style={styles.chipRow}>
          {GENDERS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, gender === opt.value && styles.chipActive]}
              onPress={() => setGender(opt.value)}
            >
              <Text style={[styles.chipText, gender === opt.value && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Adres</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Atatürk Cad. No:123, Şehir"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={address}
          onChangeText={setAddress}
          multiline
        />

        <Text style={styles.fieldLabel}>Giriş tarihi</Text>
        <TextInput
          style={styles.input}
          placeholder="GG.AA.YYYY"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={checkInDate}
          onChangeText={setCheckInDate}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.fieldLabel}>Çıkış tarihi</Text>
        <TextInput
          style={styles.input}
          placeholder="GG.AA.YYYY"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={checkOutDate}
          onChangeText={setCheckOutDate}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.fieldLabel}>Oda tipi</Text>
        <View style={styles.chipRowWrap}>
          {ROOM_TYPES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chipSmall, roomType === r && styles.chipActive]}
              onPress={() => setRoomType(r)}
            >
              <Text style={[styles.chipText, roomType === r && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.fieldLabel}>Yetişkin</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setAdults((a) => Math.max(0, a - 1))}>
                <Text style={styles.stepperText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{adults}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setAdults((a) => a + 1)}>
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.half}>
            <Text style={styles.fieldLabel}>Çocuk (12 yaş altı)</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setChildren((c) => Math.max(0, c - 1))}>
                <Text style={styles.stepperText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{children}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setChildren((c) => c + 1)}>
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>2. SÖZLEŞME METNİ</Text>
        {loadingContract ? (
          <ActivityIndicator size="small" color="#ed8936" style={styles.loader} />
        ) : (
          <View style={styles.contractBox}>
            <Text style={styles.contractText}>{contractContent || 'Sözleşme metni yükleniyor…'}</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>3. İMZALAYAN BİLGİLERİ</Text>
        <View style={styles.signerBox}>
          {signerSummary.length > 0 ? (
            signerSummary.map((line, i) => (
              <Text key={i} style={styles.signerLine}>
                {line}
              </Text>
            ))
          ) : (
            <Text style={styles.signerPlaceholder}>Yukarıdaki formu doldurun; imzalayan bilgileri burada görünecektir.</Text>
          )}
        </View>

        <TouchableOpacity style={[styles.submitBtn, saving && styles.submitBtnDisabled]} onPress={submit} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Sözleşmeyi kabul ediyorum</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {showCountryPicker &&
        renderPickerModal(
          'Ülke kodu',
          COUNTRY_PHONE_CODES,
          (item) => setPhoneCountry(item as CountryCode),
          () => setShowCountryPicker(false)
        )}
      {showNationalityPicker && (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNationalityPicker(false)}>
            <View style={[styles.modalDrawer, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.modalTitle}>Uyruk</Text>
              <FlatList
                data={COUNTRY_PHONE_CODES.map((c) => c.name)}
                keyExtractor={(name) => name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => {
                      setNationality(item);
                      setShowNationalityPicker(false);
                    }}
                  >
                    <Text style={styles.modalRowText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a365d' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 56 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#ed8936', marginTop: 16, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  inputText: { color: '#fff', fontSize: 16 },
  inputMultiline: { minHeight: 80 },
  phoneRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  countryBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    minWidth: 72,
  },
  countryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  phoneInput: { flex: 1, marginBottom: 0 },
  chipRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  chipSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  chipActive: { backgroundColor: '#ed8936' },
  chipText: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  half: { flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  stepperText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  stepperValue: { color: '#fff', fontSize: 18, fontWeight: '600', minWidth: 28, textAlign: 'center' },
  contractBox: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, marginBottom: 12, maxHeight: 220 },
  contractText: { color: '#fff', fontSize: 13, lineHeight: 20 },
  loader: { marginVertical: 20 },
  signerBox: { backgroundColor: 'rgba(237,137,54,0.2)', borderRadius: 12, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(237,137,54,0.5)' },
  signerLine: { color: '#fff', fontSize: 13, marginBottom: 4 },
  signerPlaceholder: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  submitBtn: { backgroundColor: '#ed8936', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalDrawer: { backgroundColor: '#1a365d', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12 },
  modalRow: { paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalRowText: { color: '#fff', fontSize: 16 },
});
