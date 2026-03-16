# Valoria Hotel

Otel konaklama sözleşmesi ve check-in/out yönetim sistemi. Expo 54 + TypeScript + Supabase.

## Özellikler (Faz 1)

- **Misafir akışı**: QR okuma → Dil seçimi → Sözleşme → Ad/TC-Pasaport → WhatsApp/SMS doğrulama → Dijital imza
- **Admin paneli**: Personel girişi, oda yönetimi, misafir listesi, check-in/check-out, sözleşme şablonları
- **QR kod**: Odaya özel dinamik QR, süre dolunca yenileme, logo ve oda numarası
- **Diller**: TR, EN, AR, DE, FR, RU, ES (i18next)

## Kurulum

1. Bağımlılıklar:
   ```bash
   npm install
   ```

2. `.env` dosyasını düzenleyin (`.env.example` referans):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

3. Supabase’de migration’ı çalıştırın:
   - Supabase Dashboard → SQL Editor → `supabase/migrations/001_initial_schema.sql` içeriğini yapıştırıp çalıştırın.

4. İlk personel kullanıcısı:
   - Supabase Auth ile bir kullanıcı oluşturun (e-posta/şifre).
   - `staff` tablosuna kayıt ekleyin: `auth_id` = kullanıcının UUID’si, `role` = `admin`, `email` = giriş e-postası.

5. Uygulamayı başlatın:
   ```bash
   npx expo start
   ```

## Proje yapısı

- `app/` – Expo Router ekranları
  - `index.tsx` – Ana giriş (Misafir QR / Personel girişi)
  - `guest/` – Misafir akışı (QR → dil → sözleşme → form → doğrulama → imza → başarı)
  - `admin/` – Admin paneli (giriş, odalar, misafirler, check-in, sözleşmeler)
- `lib/supabase.ts` – Supabase client
- `stores/` – Zustand (guestFlowStore, authStore)
- `i18n/` – Çoklu dil
- `supabase/migrations/` – Veritabanı şeması

## QR kod

- Her oda için `room_qr_codes` tablosunda token tutulur; süre dolunca admin panelinden “QR Kodu Yenile” ile yeni token üretilir.
- QR içeriği: `https://<APP_URL>/guest?token=<TOKEN>` veya sadece token (uygulama her iki formatı kabul eder).

## Sonraki fazlar

- Faz 2: Personel rolleri, haberleşme, gelişmiş çoklu dil.
- Faz 3: Müşteri uygulaması (oda servisi, temizlik talebi vb.), akıllı oda entegrasyonu.
