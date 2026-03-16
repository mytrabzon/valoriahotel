import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

try {
  console.log('[Valoria] [INFO] i18n yükleniyor');
} catch (_) {}

export const LANGUAGES = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
] as const;

export type LangCode = (typeof LANGUAGES)[number]['code'];

const resources = {
  tr: {
    translation: {
      appName: 'Valoria Hotel',
      selectLanguage: 'Dil Seçin',
      scanQR: 'QR Kodu Okutun',
      scanQRDesc: 'Konaklama sözleşmesi için odanızdaki QR kodu okutun.',
      contract: 'Konaklama Sözleşmesi',
      acceptContract: 'Sözleşmeyi kabul ediyorum',
      next: 'İleri',
      back: 'Geri',
      guestInfo: 'Misafir Bilgileri',
      fullName: 'Ad Soyad',
      idNumber: 'TC Kimlik No / Pasaport No',
      idType: 'Kimlik Türü',
      idTypeTC: 'T.C. Kimlik',
      idTypePassport: 'Pasaport',
      phone: 'Telefon',
      email: 'E-posta',
      nationality: 'Uyruk',
      sendCode: 'Doğrulama Kodu Gönder',
      verificationCode: 'Doğrulama Kodu',
      enterCode: 'Kodu girin',
      verify: 'Doğrula',
      signContract: 'Sözleşmeyi İmzalayın',
      signBelow: 'Aşağıdaki alana imzanızı atın',
      clear: 'Temizle',
      submit: 'Gönder',
      success: 'Kayıt Tamamlandı',
      successDesc: 'Sözleşmeniz onaylandı. Resepsiyona bekleyebilirsiniz.',
      error: 'Hata',
      invalidQR: 'Geçersiz veya süresi dolmuş QR kod.',
      invalidCode: 'Geçersiz veya süresi dolmuş kod.',
      required: 'Bu alan zorunludur',
      loading: 'Yükleniyor...',
      policiesConsentTitle: 'Gizlilik ve Kullanım Şartları',
      policiesConsentSubtitle: 'Devam etmek için aşağıdaki sözleşmeleri okuyup kabul etmeniz gerekmektedir.',
      acceptPrivacy: 'Gizlilik Sözleşmesi\'ni okudum ve kabul ediyorum',
      acceptTerms: 'Kullanım Şartları\'nı okudum ve kabul ediyorum',
      privacyPolicy: 'Gizlilik Sözleşmesi',
      termsOfService: 'Kullanım Şartları',
      confirmConsent: 'Onaylıyorum',
      cookiePolicy: 'Çerez Politikası',
      contact: 'İletişim',
      legalAndContact: 'Yasal & İletişim',
    },
  },
  en: {
    translation: {
      appName: 'Valoria Hotel',
      selectLanguage: 'Select Language',
      scanQR: 'Scan QR Code',
      scanQRDesc: 'Scan the QR code in your room for the accommodation agreement.',
      contract: 'Accommodation Agreement',
      acceptContract: 'I accept the agreement',
      next: 'Next',
      back: 'Back',
      guestInfo: 'Guest Information',
      fullName: 'Full Name',
      idNumber: 'ID / Passport Number',
      idType: 'ID Type',
      idTypeTC: 'National ID',
      idTypePassport: 'Passport',
      phone: 'Phone',
      email: 'Email',
      nationality: 'Nationality',
      sendCode: 'Send Verification Code',
      verificationCode: 'Verification Code',
      enterCode: 'Enter code',
      verify: 'Verify',
      signContract: 'Sign the Agreement',
      signBelow: 'Sign in the box below',
      clear: 'Clear',
      submit: 'Submit',
      success: 'Registration Complete',
      successDesc: 'Your agreement has been confirmed. You may proceed to reception.',
      error: 'Error',
      invalidQR: 'Invalid or expired QR code.',
      invalidCode: 'Invalid or expired code.',
      required: 'This field is required',
      loading: 'Loading...',
      policiesConsentTitle: 'Privacy & Terms of Service',
      policiesConsentSubtitle: 'To continue, please read and accept the following agreements.',
      acceptPrivacy: 'I have read and accept the Privacy Policy',
      acceptTerms: 'I have read and accept the Terms of Service',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      confirmConsent: 'I Accept',
      cookiePolicy: 'Cookie Policy',
      contact: 'Contact',
      legalAndContact: 'Legal & Contact',
    },
  },
  ar: {
    translation: {
      privacyPolicy: 'سياسة الخصوصية',
      termsOfService: 'شروط الاستخدام',
      policiesConsentTitle: 'الخصوصية وشروط الاستخدام',
      policiesConsentSubtitle: 'لمتابعة، يرجى قراءة وقبول الاتفاقيات التالية.',
      acceptPrivacy: 'لقد قرأت وأقبل سياسة الخصوصية',
      acceptTerms: 'لقد قرأت وأقبل شروط الاستخدام',
      confirmConsent: 'أوافق',
      cookiePolicy: 'سياسة ملفات تعريف الارتباط',
      contact: 'اتصل',
      legalAndContact: 'قانوني واتصال',
    },
  },
  de: {
    translation: {
      privacyPolicy: 'Datenschutzerklärung',
      termsOfService: 'Nutzungsbedingungen',
      policiesConsentTitle: 'Datenschutz & Nutzungsbedingungen',
      policiesConsentSubtitle: 'Bitte lesen und akzeptieren Sie die folgenden Vereinbarungen.',
      acceptPrivacy: 'Ich habe die Datenschutzerklärung gelesen und akzeptiert',
      acceptTerms: 'Ich habe die Nutzungsbedingungen gelesen und akzeptiert',
      confirmConsent: 'Ich akzeptiere',
      cookiePolicy: 'Cookie-Richtlinie',
      contact: 'Kontakt',
      legalAndContact: 'Rechtliches & Kontakt',
    },
  },
  fr: {
    translation: {
      privacyPolicy: 'Politique de confidentialité',
      termsOfService: 'Conditions d\'utilisation',
      policiesConsentTitle: 'Confidentialité et conditions d\'utilisation',
      policiesConsentSubtitle: 'Pour continuer, veuillez lire et accepter les accords suivants.',
      acceptPrivacy: 'J\'ai lu et j\'accepte la politique de confidentialité',
      acceptTerms: 'J\'ai lu et j\'accepte les conditions d\'utilisation',
      confirmConsent: 'J\'accepte',
      cookiePolicy: 'Politique des cookies',
      contact: 'Contact',
      legalAndContact: 'Mentions légales & contact',
    },
  },
  ru: {
    translation: {
      privacyPolicy: 'Политика конфиденциальности',
      termsOfService: 'Условия использования',
      policiesConsentTitle: 'Конфиденциальность и условия использования',
      policiesConsentSubtitle: 'Чтобы продолжить, прочитайте и примите следующие соглашения.',
      acceptPrivacy: 'Я прочитал и принимаю политику конфиденциальности',
      acceptTerms: 'Я прочитал и принимаю условия использования',
      confirmConsent: 'Принимаю',
      cookiePolicy: 'Политика использования файлов cookie',
      contact: 'Контакты',
      legalAndContact: 'Правовая информация и контакты',
    },
  },
  es: {
    translation: {
      privacyPolicy: 'Política de privacidad',
      termsOfService: 'Términos de uso',
      policiesConsentTitle: 'Privacidad y términos de uso',
      policiesConsentSubtitle: 'Para continuar, lea y acepte los siguientes acuerdos.',
      acceptPrivacy: 'He leído y acepto la política de privacidad',
      acceptTerms: 'He leído y acepto los términos de uso',
      confirmConsent: 'Acepto',
      cookiePolicy: 'Política de cookies',
      contact: 'Contacto',
      legalAndContact: 'Legal y contacto',
    },
  },
};

// Fallback missing keys to English
LANGUAGES.forEach(({ code }) => {
  if (code !== 'tr' && code !== 'en' && (resources as Record<string, { translation: Record<string, string> }>)[code].translation && Object.keys((resources as Record<string, { translation: Record<string, string> }>)[code].translation).length === 0) {
    (resources as Record<string, { translation: Record<string, string> }>)[code].translation = { ...resources.en.translation };
  }
});

i18n.use(initReactI18next).init({
  resources,
  lng: 'tr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
console.log('[Valoria] [INFO] i18n init tamamlandı');

export default i18n;
