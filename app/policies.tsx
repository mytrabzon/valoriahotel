import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setPolicyConsent, getPendingGuest, clearPendingGuest } from '@/lib/policyConsent';
import { useGuestFlowStore } from '@/stores/guestFlowStore';
import { LANGUAGES } from '@/i18n';

export default function PoliciesConsentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = params.next === 'guest' ? 'guest' : 'customer';
  const { t, i18n } = useTranslation();
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canConfirm = privacyChecked && termsChecked;

  const setQR = useGuestFlowStore((s) => s.setQR);

  const handleConfirm = async () => {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    try {
      await setPolicyConsent();
      if (next === 'guest') {
        const pending = await getPendingGuest();
        if (pending) {
          setQR(pending.token, pending.roomId, pending.roomNumber);
          await clearPendingGuest();
          router.replace('/guest/language');
        } else {
          router.replace('/guest');
        }
      } else {
        router.replace('/customer');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openLegal = (type: 'privacy' | 'terms') => {
    router.push({ pathname: '/legal/[type]', params: { type } });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('policiesConsentTitle')}</Text>
        <Text style={styles.subtitle}>{t('policiesConsentSubtitle')}</Text>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setPrivacyChecked((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, privacyChecked && styles.checkboxChecked]}>
            {privacyChecked && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <View style={styles.checkLabel}>
            <Text style={styles.checkText}>{t('acceptPrivacy')}</Text>
            <TouchableOpacity onPress={() => openLegal('privacy')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.link}>{t('privacyPolicy')} →</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setTermsChecked((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, termsChecked && styles.checkboxChecked]}>
            {termsChecked && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <View style={styles.checkLabel}>
            <Text style={styles.checkText}>{t('acceptTerms')}</Text>
            <TouchableOpacity onPress={() => openLegal('terms')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.link}>{t('termsOfService')} →</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !canConfirm && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t('confirmConsent')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.langStrip}>
          {LANGUAGES.map(({ code, label }) => (
            <TouchableOpacity
              key={code}
              style={[styles.langBtn, i18n.language === code && styles.langBtnActive]}
              onPress={() => i18n.changeLanguage(code)}
            >
              <Text style={[styles.langBtnText, i18n.language === code && styles.langBtnTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a365d',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 32,
    lineHeight: 22,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    marginRight: 14,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#ed8936',
    borderColor: '#ed8936',
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: { flex: 1 },
  checkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  link: {
    color: '#90cdf4',
    fontSize: 14,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#ed8936',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  langStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 32,
    gap: 8,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  langBtnActive: {
    backgroundColor: '#ed8936',
  },
  langBtnText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
  },
  langBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
