# Dil Paketleri ve Çok Dilli Uygulama (i18n)

## Hazır paket var mı?

**Hayır.** Özel uygulama metinleri için “tüm uygulama dil paketi” diye hazır bir paket yok. Valoria’da zaten **react-i18next** kullanılıyor; çeviriler `i18n/index.ts` içinde tanımlı. Dil seçildiğinde sadece `t('anahtar')` ile kullanılan metinler değişir.

## Şu anki durum

- **7 dil:** Türkçe (tr), İngilizce (en), Arapça (ar), Almanca (de), Fransızca (fr), Rusça (ru), İspanyolca (es).
- **Tam çevrilen kısım:** Misafir akışı (QR, sözleşme, form, doğrulama, imza, başarı), yasal sayfalar (gizlilik, kullanım şartları, çerez), profil yasal linkleri.
- Bu ekranlarda dil değişince **tüm metinler** seçilen dilde görünür.

## “Tüm uygulama” aynı dilde olsun istiyorsanız

1. **Yeni ekranlarda:** Metinleri sabit yazmak yerine `useTranslation()` ve `t('anahtar')` kullanın.
2. **Mevcut ekranlarda:** Sabit Türkçe/İngilizce metinleri bulup `t('yeniAnahtar')` ile değiştirin.
3. **Çevirileri ekleyin:** Her yeni anahtar için `i18n/index.ts` içindeki ilgili dil objesine çeviriyi ekleyin (tr, en, ar, de, fr, ru, es).

Örnek:

```tsx
import { useTranslation } from 'react-i18next';

function MyScreen() {
  const { t } = useTranslation();
  return <Text>{t('homeWelcome')}</Text>;
}
```

`i18n/index.ts` içinde:

- `tr.translation.homeWelcome: 'Hoş geldiniz'`
- `en.translation.homeWelcome: 'Welcome'`
- … diğer diller için de aynı anahtar.

## Çeviri araçları (isteğe bağlı)

- **Crowdin / Locize / Phrase:** i18n anahtarlarını yükleyip çevirmenlere verir, sonra JSON/TS olarak geri alırsınız.
- **Google Translate / DeepL API:** Mevcut `i18n/index.ts` veya JSON’dan anahtarları çekip toplu çeviri script’i yazılabilir; çıktıyı yine aynı yapıya (i18n veya JSON) yazarsınız.

Özet: Hazır “tüm uygulama” dil paketi yok; dil seçimi şu an sadece `t()` kullanılan yerlerde çalışıyor. Tüm sayfaların seçilen dilde olması için ekran ekran `t()` kullanımı ve her dil için anahtar eklemeniz yeterli.
