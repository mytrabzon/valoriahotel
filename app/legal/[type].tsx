import { useEffect } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';
import { getLegalHtml } from '@/lib/legalContent';
import type { LegalType, LegalLang } from '@/lib/legalContent';

export default function LegalDocumentScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const navigation = useNavigation();
  const { height } = useWindowDimensions();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'tr') as LegalLang;
  const legalType: LegalType = type === 'terms' ? 'terms' : type === 'cookies' ? 'cookies' : 'privacy';
  const html = getLegalHtml(legalType, lang);

  useEffect(() => {
    const title = legalType === 'privacy' ? t('privacyPolicy') : legalType === 'terms' ? t('termsOfService') : t('cookiePolicy');
    navigation.setOptions({ title });
  }, [legalType, navigation, t]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
});
