import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import {
  EMERGENCY_CONSULATES,
  filterConsulates,
  consulateName,
  consulateLabel,
  consulateNote,
  phoneToTelHref,
  phoneDisplay,
} from '@/lib/emergencyConsulatesData';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function EmergencyConsulatesModal({ visible, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  /** Modal altta sabit olduğu için klavye açıkken sheet’i yukarı alır (Android/iOS) */
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (visible) setQuery('');
    else {
      setKeyboardOffset(0);
      Keyboard.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const h = e.endCoordinates?.height;
        setKeyboardOffset(typeof h === 'number' && h > 0 ? h : 0);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOffset(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const filtered = useMemo(
    () => filterConsulates(EMERGENCY_CONSULATES, query, i18n.language),
    [query, i18n.language]
  );

  const openTel = async (phone: string) => {
    const href = phoneToTelHref(phone);
    try {
      const can = await Linking.canOpenURL(href);
      if (can) await Linking.openURL(href);
      else Alert.alert(t('error'), t('couldNotOpen'));
    } catch {
      Alert.alert(t('error'), t('couldNotOpen'));
    }
  };

  const sheetMaxH =
    keyboardOffset > 0
      ? Math.min(height * 0.88, height - keyboardOffset - insets.top - 16)
      : height * 0.92;
  const listMaxH =
    keyboardOffset > 0
      ? Math.max(180, sheetMaxH - 220)
      : Math.max(200, height * 0.58);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheetWrap,
            {
              bottom: keyboardOffset,
              maxHeight: sheetMaxH,
            },
          ]}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('emergencyConsulatesTitle')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.intro}>{t('emergencyConsulatesIntro')}</Text>
          <TextInput
            style={styles.search}
            placeholder={t('emergencyConsulatesSearchPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
          />
          <ScrollView
            style={[styles.scroll, { maxHeight: listMaxH }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {filtered.length === 0 ? (
              <Text style={styles.empty}>{t('emergencyConsulatesEmpty')}</Text>
            ) : (
              filtered.map((c) => (
                <View key={c.id} style={styles.countryBlock}>
                  <Text style={styles.countryTitle}>
                    {c.flag} {consulateName(c, i18n.language)}
                  </Text>
                  {consulateNote(c, i18n.language) ? (
                    <Text style={styles.note}>{consulateNote(c, i18n.language)}</Text>
                  ) : null}
                  {c.offices.map((o, i) => (
                    <View key={`${c.id}-${i}`} style={styles.officeRow}>
                      <Text style={styles.addr}>📍 {consulateLabel(o, i18n.language)}</Text>
                      <Pressable
                        onPress={() => openTel(o.phone)}
                        style={({ pressed }) => [styles.telRow, pressed && styles.telRowPressed]}
                      >
                        <Text style={styles.telEmoji}>📞</Text>
                        <View>
                          <Text style={styles.telNumber}>{phoneDisplay(o.phone)}</Text>
                          <Text style={styles.telHint}>{t('emergencyConsulatesTapToCall')}</Text>
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))
            )}
            <Text style={styles.disclaimer}>{t('emergencyConsulatesDisclaimer')}</Text>
          </ScrollView>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
  },
  sheet: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: 8,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.colors.text, paddingRight: 8 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 22, color: theme.colors.textSecondary, fontWeight: '500' },
  intro: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginBottom: 10 },
  search: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 12,
  },
  scroll: {},
  countryBlock: {
    marginBottom: 18,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 12,
  },
  countryTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  note: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginBottom: 8 },
  officeRow: { marginTop: 8 },
  addr: { fontSize: 14, color: theme.colors.text, lineHeight: 20, marginBottom: 6 },
  telRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.sm,
  },
  telRowPressed: { opacity: 0.88 },
  telEmoji: { fontSize: 20 },
  telNumber: { fontSize: 17, fontWeight: '700', color: theme.colors.primary, letterSpacing: 0.3 },
  telHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: theme.colors.textSecondary, paddingVertical: 24, fontSize: 15 },
  disclaimer: { fontSize: 11, color: theme.colors.textMuted, lineHeight: 16, textAlign: 'center', marginTop: 8 },
});
