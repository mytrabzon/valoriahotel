import { useEffect, useState, useCallback, useRef } from 'react';
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
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { COUNTRY_PHONE_CODES, type CountryCode } from '@/constants/countryPhoneCodes';
import { LANGUAGES } from '@/i18n';

const CONTRACT_LANGS = LANGUAGES;

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
  { value: 'tc', label: 'TC Kimlik No' },
  { value: 'passport', label: 'Pasaport No' },
  { value: 'other', label: 'Sürücü Belgesi No' },
] as const;

const GENDERS = [
  { value: 'male', label: 'Erkek' },
  { value: 'female', label: 'Kadın' },
] as const;

const ROOM_TYPES = ['Tek kişilik', 'Çift kişilik', 'Üç kişilik', 'Aile', 'Suite', 'Diğer'];

// Göz yormayan, okunaklı renk paleti
const COLORS = {
  bg: '#f5f6f8',
  card: '#ffffff',
  cardBorder: '#e8eaed',
  text: '#1f2937',
  textSecondary: '#6b7280',
  label: '#374151',
  accent: '#0ea5e9',
  accentLight: '#e0f2fe',
  success: '#059669',
  inputBg: '#f9fafb',
  inputBorder: '#e5e7eb',
  divider: '#e5e7eb',
};

export default function GuestSignOneScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string; lang?: string; t?: string; l?: string }>();
  const { qrToken, roomId, setQR, setStep, setGuestId } = useGuestFlowStore();
  const { setAppToken } = useGuestMessagingStore();

  const token = (params.token ?? params.t ?? qrToken ?? '').trim();
  const lang = (params.lang ?? params.l ?? i18n.language ?? 'tr').toLowerCase();

  if (Platform.OS === 'web' && (!supabaseUrl || !supabaseAnonKey)) {
    return (
      <View style={[styles.envContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.envTitle}>Yapılandırma eksik</Text>
        <Text style={styles.envText}>
          Sözleşme sayfası için Vercel ortam değişkenleri tanımlanmalı.{'\n\n'}
          EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ekleyin.{'\n\n'}
          Detay: docs/VERCEL_ENV.md
        </Text>
      </View>
    );
  }

  const [contractContent, setContractContent] = useState('');
  const [contractLang, setContractLang] = useState(lang);
  const [loadingContract, setLoadingContract] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showNationalityPicker, setShowNationalityPicker] = useState(false);
  const translatedCache = useRef<Record<string, string>>({});

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

  const fetchContract = useCallback(async (lng: string) => {
    setLoadingContract(true);
    const { data } = await supabase
      .from('contract_templates')
      .select('content')
      .eq('lang', lng)
      .eq('version', 2)
      .eq('is_active', true)
      .maybeSingle();
    let content = data?.content?.trim() ?? '';
    if (!content) {
      const { data: fallback } = await supabase
        .from('contract_templates')
        .select('content')
        .eq('lang', lng)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      content = fallback?.content?.trim() ?? '';
    }
    if (!content && lng !== 'tr') {
      if (translatedCache.current[lng]) {
        setContractContent(translatedCache.current[lng]);
        setLoadingContract(false);
        setTranslating(false);
        return;
      }
      setTranslating(true);
      try {
        const { data: trData } = await supabase
          .from('contract_templates')
          .select('content')
          .eq('lang', 'tr')
          .eq('version', 2)
          .eq('is_active', true)
          .maybeSingle();
        const trContent = trData?.content?.trim() ?? '';
        if (trContent) {
          const { data: fnData, error: fnError } = await supabase.functions.invoke('translate-contract', {
            body: { sourceTitle: 'Konaklama Sözleşmesi ve Otel Kuralları', sourceContent: trContent },
          });
          if (!fnError && fnData) {
            const translations = (fnData as { translations?: Record<string, { content: string }> })?.translations;
            const translated = translations?.[lng]?.content?.trim();
            if (translated) {
              translatedCache.current[lng] = translated;
              content = translated;
            }
          }
        }
        if (!content) {
          const { data: trFallback } = await supabase
            .from('contract_templates')
            .select('content')
            .eq('lang', 'tr')
            .eq('is_active', true)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();
          content = trFallback?.content ?? '';
        }
      } catch (_) {}
      setTranslating(false);
    }
    setContractContent(content);
    setLoadingContract(false);
  }, []);

  useEffect(() => {
    fetchContract(contractLang);
  }, [contractLang, fetchContract]);

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
    fullPhone && `Telefon: ${fullPhone}`,
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
      Alert.alert(t('error'), 'Ad soyad alanı zorunludur.');
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert(t('error'), 'Telefon numarası zorunludur.');
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
          source: Platform.OS === 'web' ? 'web' : 'app',
          guest_id: guest?.id ?? null,
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageTitleWrap}>
          <Text style={styles.pageTitle}>Konaklama sözleşmesi</Text>
          <Text style={styles.pageSubtitle}>Bilgilerinizi doldurup sözleşmeyi okuyarak onaylayın.</Text>
        </View>

        {/* 1. Kişisel bilgiler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kişisel bilgiler</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Ad soyad *</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Ahmet Yılmaz"
              placeholderTextColor={COLORS.textSecondary}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
            <Text style={styles.label}>Kimlik türü</Text>
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
            <Text style={styles.label}>Kimlik numarası</Text>
            <TextInput
              style={styles.input}
              placeholder="TC, pasaport veya sürücü belgesi no"
              placeholderTextColor={COLORS.textSecondary}
              value={idNumber}
              onChangeText={setIdNumber}
              keyboardType="default"
            />
            <Text style={styles.label}>Telefon (WhatsApp) *</Text>
            <View style={styles.phoneRow}>
              <TouchableOpacity style={styles.countryBtn} onPress={() => setShowCountryPicker(true)}>
                <Text style={styles.countryBtnText}>{phoneCountry.dial}</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                placeholder="5XX XXX XX XX"
                placeholderTextColor={COLORS.textSecondary}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
            </View>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              placeholder="ornek@email.com"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Uyruk</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowNationalityPicker(true)}>
              <Text style={styles.inputValue}>{nationality || 'Seçiniz'}</Text>
            </TouchableOpacity>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Doğum tarihi</Text>
                <TextInput
                  style={styles.input}
                  placeholder="GG.AA.YYYY"
                  placeholderTextColor={COLORS.textSecondary}
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Cinsiyet</Text>
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
              </View>
            </View>
            <Text style={styles.label}>Adres</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Cadde, sokak, şehir"
              placeholderTextColor={COLORS.textSecondary}
              value={address}
              onChangeText={setAddress}
              multiline
            />
          </View>
        </View>

        {/* 2. Konaklama bilgileri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Konaklama bilgileri</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Giriş tarihi</Text>
                <TextInput
                  style={styles.input}
                  placeholder="GG.AA.YYYY"
                  placeholderTextColor={COLORS.textSecondary}
                  value={checkInDate}
                  onChangeText={setCheckInDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Çıkış tarihi</Text>
                <TextInput
                  style={styles.input}
                  placeholder="GG.AA.YYYY"
                  placeholderTextColor={COLORS.textSecondary}
                  value={checkOutDate}
                  onChangeText={setCheckOutDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <Text style={styles.label}>Oda tipi</Text>
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
                <Text style={styles.label}>Yetişkin sayısı</Text>
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
                <Text style={styles.label}>Çocuk (12 yaş altı)</Text>
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
          </View>
        </View>

        {/* 3. Sözleşme metni - Kutudan çıkarıldı, sayfa üzerinde doğrudan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sözleşme metni</Text>
          <Text style={styles.sectionHint}>Dil seçin; sözleşme seçilen dilde tam metin olarak çevrilir.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langStrip} contentContainerStyle={styles.langStripContent}>
            {CONTRACT_LANGS.map(({ code, label }) => (
              <TouchableOpacity
                key={code}
                style={[styles.langChip, contractLang === code && styles.langChipActive]}
                onPress={() => {
                  setContractLang(code);
                  fetchContract(code);
                }}
                disabled={loadingContract || translating}
              >
                <Text style={[styles.langChipText, contractLang === code && styles.langChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {loadingContract || translating ? (
            <ActivityIndicator size="small" color={COLORS.accent} style={styles.loader} />
          ) : (
            <View style={styles.contractBody}>
              <Text style={styles.contractText}>{contractContent || 'Sözleşme metni yükleniyor…'}</Text>
            </View>
          )}
        </View>

        {/* 4. İmza özeti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Onay özeti</Text>
          <View style={styles.signerCard}>
            {signerSummary.length > 0 ? (
              signerSummary.map((line, i) => (
                <Text key={i} style={styles.signerLine}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={styles.signerPlaceholder}>Formu doldurduğunuzda burada görünecektir.</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={saving}
          activeOpacity={0.85}
        >
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  envContainer: { flex: 1, backgroundColor: COLORS.bg, padding: 24 },
  envTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  envText: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 24, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  pageTitleWrap: { alignItems: 'center', marginBottom: 24 },
  pageTitle: { fontSize: 26, fontWeight: '700', color: COLORS.text, marginBottom: 6, textAlign: 'center' },
  pageSubtitle: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22, textAlign: 'center' },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.label,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  sectionHint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 },
  langStrip: { maxHeight: 44, marginBottom: 12 },
  langStripContent: { paddingVertical: 4, gap: 8, alignItems: 'center', paddingRight: 16 },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    marginRight: 8,
  },
  langChipActive: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accent },
  langChipText: { color: COLORS.text, fontSize: 13 },
  langChipTextActive: { color: COLORS.accent, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  label: { fontSize: 14, fontWeight: '500', color: COLORS.label, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  inputValue: { color: COLORS.text, fontSize: 16 },
  inputMultiline: { minHeight: 88 },
  phoneRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  countryBtn: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    minWidth: 76,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  countryBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  phoneInput: { flex: 1, marginBottom: 0 },
  chipRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  chipSmall: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  chipActive: { backgroundColor: COLORS.accentLight, borderColor: COLORS.accent },
  chipText: { color: COLORS.text, fontSize: 14 },
  chipTextActive: { color: COLORS.accent, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 16 },
  half: { flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperText: { color: COLORS.text, fontSize: 20, fontWeight: '600' },
  stepperValue: { color: COLORS.text, fontSize: 18, fontWeight: '600', minWidth: 32, textAlign: 'center' },
  contractBody: { paddingVertical: 8 },
  contractText: { color: COLORS.text, fontSize: 16, lineHeight: 26 },
  loader: { marginVertical: 24 },
  signerCard: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  signerLine: { color: COLORS.text, fontSize: 14, marginBottom: 6, lineHeight: 20 },
  signerPlaceholder: { color: COLORS.textSecondary, fontSize: 14 },
  submitBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalDrawer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  modalRow: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  modalRowText: { color: COLORS.text, fontSize: 16 },
});
