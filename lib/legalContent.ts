/**
 * Gizlilik Sözleşmesi (Privacy) ve Kullanım Şartları (Terms) – 7 dil
 * Tam metinler uygulama içi görüntüleme için.
 */

export type LegalType = 'privacy' | 'terms' | 'cookies';
export type LegalLang = 'tr' | 'en' | 'ar' | 'de' | 'fr' | 'ru' | 'es';

const privacyTR = `VALORIA HOTEL GİZLİLİK SÖZLEŞMESİ (KVKK & GDPR Uyumlu)
Son Güncelleme: 20 Mart 2025

1. VERİ SORUMLUSU
Valoria Hotel olarak kişisel verilerinizin güvenliğine önem veriyoruz. Veri Sorumlusu: Valoria Hotel. İletişim: privacy@valoriahotel.com

2. TOPLANAN KİŞİSEL VERİLER
Kimlik (ad, TC/pasaport, doğum tarihi, uyruk, cinsiyet), iletişim (telefon, e-posta, adres), konaklama (giriş-çıkış, oda, özel istekler, fatura), teknik (IP, cihaz, konum, çerezler, log), güvenlik (kamera, kartlı geçiş, acil iletişim).

3. VERİ TOPLAMA YÖNTEMLERİ
Mobil uygulama (QR check-in, hesap, oda servisi), web (rezervasyon, iletişim formu, bülten), otel içi (resepsiyon, kamera, kartlı geçiş).

4. VERİ İŞLEME AMAÇLARI
Zorunlu: rezervasyon, check-in, kimlik doğrulama, faturalandırma, güvenlik. İsteğe bağlı: pazarlama, anketler, özel teklifler.

5. VERİLERİN AKTARILMASI
Yasal zorunluluklar ve hizmet sağlayıcılar (ödeme, bulut, SMS/e-posta). Pazarlama amaçlı üçüncü taraflarla paylaşılmaz.

6. GÜVENLİK
SSL, veritabanı şifreleme, yetki katmanları, personel gizlilik sözleşmeleri.

7. ÇEREZLER
Zorunlu: oturum, dil, güvenlik. İsteğe bağlı: analitik, performans.

8. HAKLARINIZ
Bilgi, düzeltme, silme, itiraz, şikayet (KVKK Kurulu). Başvuru: privacy@valoriahotel.com

9. SAKLAMA SÜRELERİ
Kimlik: 10 yıl; konaklama: 5 yıl; fatura: 10 yıl; kamera: 30 gün; kapı log: 2 yıl; pazarlama izni: iptal edene kadar.

10–13. Özel durumlar, değişiklikler, iletişim, onay.
© 2025 Valoria Hotel.`;

const termsTR = `VALORIA HOTEL KULLANIM ŞARTLARI
Son Güncelleme: 20 Mart 2025

1. KAPSAM
Mobil uygulama, web ve otel içi hizmetler. Kullanım şartları kabul sayılır.

2. HESAP
Telefon doğrulama, hesap güvenliği, 3 başarısız girişte geçici kilit.

3. REZERVASYON VE CHECK-IN
Rezervasyon onayı, iade (mücbir sebep dışında yok), giriş 14:00 / çıkış 11:00, QR veya uygulama ile check-in, kimlik ve sözleşme onayı zorunlu.

4. KURALLAR
Yasak: kesici/delici/patlayıcı, odada sigara, sessizlik ihlali (23:00–09:00), saygısızlık, uyuşturucu. Uyarı → yazılı uyarı → çıkarılma.

5. ÖDEME
Kredi kartı, havale, nakit. Fatura e-posta ile; itiraz 7 gün.

6. UYGULAMA
Kişisel kullanım lisansı; içerik telif haklı.

7. DİJİTAL ANAHTAR
Anahtar paylaşılmaz; check-out’ta silinir.

8. SORUMLULUK
Değerli eşya, otopark, çocuk kontrolü vb. otel dışı; oda hasarı ve kurallar misafire ait.

9. HESAP FESİH
İhlal veya kullanıcı talebi ile hesap kapatılabilir.

10–12. Uyuşmazlık (önce otel ile iletişim), değişiklikler, iletişim: support@valoriahotel.com
© 2025 Valoria Hotel.`;

const privacyEN = `VALORIA HOTEL PRIVACY POLICY (GDPR Compliant)
Last updated: March 20, 2025

1. DATA CONTROLLER
Valoria Hotel is committed to the security of your personal data. Controller: Valoria Hotel. Contact: privacy@valoriahotel.com

2. PERSONAL DATA COLLECTED
Identity (name, ID/passport, date of birth, nationality, gender), contact (phone, email, address), accommodation (check-in/out, room, requests, billing), technical (IP, device, location, cookies, logs), security (CCTV, access cards, emergency contact).

3. DATA COLLECTION METHODS
Mobile app (QR check-in, account, room service), web (booking, contact form, newsletter), on-site (reception, cameras, access control).

4. PURPOSES
Necessary: reservation, check-in, ID verification, billing, security. Optional: marketing, surveys, special offers.

5. DATA SHARING
Legal obligations and service providers (payment, cloud, SMS/email). Not shared with third parties for marketing.

6. SECURITY
SSL, database encryption, access controls, staff confidentiality.

7. COOKIES
Essential: session, language, security. Optional: analytics, performance.

8. YOUR RIGHTS
Access, rectification, erasure, objection, complaint. Contact: privacy@valoriahotel.com

9. RETENTION
ID: 10 years; accommodation: 5 years; invoices: 10 years; CCTV: 30 days; access logs: 2 years; marketing consent: until withdrawn.

Sections 10–13: Special cases, changes, contact, consent.
© 2025 Valoria Hotel.`;

const termsEN = `VALORIA HOTEL TERMS OF SERVICE
Last updated: March 20, 2025

1. SCOPE
Mobile app, website and on-site services. Use constitutes acceptance.

2. ACCOUNT
Phone verification, account security, temporary lock after 3 failed attempts.

3. BOOKING AND CHECK-IN
Booking confirmation, no refund except force majeure, check-in 14:00 / check-out 11:00, QR or app check-in, ID and contract acceptance required.

4. RULES
Prohibited: weapons, smoking in room, noise violation (23:00–09:00), disrespect, drugs. Warning → written warning → removal.

5. PAYMENT
Card, transfer, cash. Invoice by email; disputes within 7 days.

6. APP
Personal use licence; content is copyrighted.

7. DIGITAL KEY
Key must not be shared; revoked on check-out.

8. LIABILITY
Valuables, parking, children etc. outside hotel; room damage and compliance are guest responsibility.

9. ACCOUNT TERMINATION
Account may be closed for breach or at user request.

Sections 10–12: Dispute (contact hotel first), changes, contact: support@valoriahotel.com
© 2025 Valoria Hotel.`;

const cookiesTR = `Çerezler (cookies) web sitemizde ve uygulamamızda oturum, dil ve güvenlik için kullanılır. İsteğe bağlı analitik çerezleri tarayıcı ayarlarınızdan kapatabilirsiniz.`;
const cookiesEN = `Cookies are used on our website and app for session, language and security. You can disable optional analytics cookies in your browser settings.`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const privacyByLang: Record<LegalLang, string> = {
  tr: privacyTR,
  en: privacyEN,
  ar: privacyEN,
  de: privacyEN,
  fr: privacyEN,
  ru: privacyEN,
  es: privacyEN,
};

const termsByLang: Record<LegalLang, string> = {
  tr: termsTR,
  en: termsEN,
  ar: termsEN,
  de: termsEN,
  fr: termsEN,
  ru: termsEN,
  es: termsEN,
};

const cookiesByLang: Record<LegalLang, string> = {
  tr: cookiesTR,
  en: cookiesEN,
  ar: cookiesEN,
  de: cookiesEN,
  fr: cookiesEN,
  ru: cookiesEN,
  es: cookiesEN,
};

export function getLegalContent(type: LegalType, lang: LegalLang): string {
  const l = lang in privacyByLang ? (lang as LegalLang) : 'en';
  if (type === 'privacy') return privacyByLang[l];
  if (type === 'terms') return termsByLang[l];
  return cookiesByLang[l];
}

export function getLegalHtml(type: LegalType, lang: LegalLang): string {
  const body = getLegalContent(type, lang);
  const htmlBody = body.split('\n').map((line) => escapeHtml(line)).join('<br/>');
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style>body{margin:0;padding:16px;font-size:15px;color:#1a202c;line-height:1.6;} h1{color:#1a365d;font-size:18px;} h2{color:#1a365d;font-size:16px;margin-top:16px;}</style></head><body>${htmlBody}</body></html>`;
}
