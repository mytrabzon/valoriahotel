# Sözleşme & QR Sistemi – Mevcut Durum

## .env ayarınız

- `EXPO_PUBLIC_PUBLIC_CONTRACT_URL=https://valoria.app/sozlesme` **tanımlı.**
- Yani sözleşme onay QR’ları ve linkler **https://valoria.app/sozlesme?t=...&l=tr** adresine gidecek.

---

## Hangi aşamadasınız?

| Aşama | Durum | Ne yapmalısınız? |
|--------|--------|-------------------|
| 1. Veritabanı | Migration’lar çalıştırıldı mı? | `supabase db push` ile **062** (app_settings + contract-media) ve **063** (otel kuralları metni) uygulanmalı. |
| 2. valoria.app/sozlesme sayfası | Açılıyor mu? | valoria.app’te **/sozlesme** path’inde `docs/valoria-app-sozlesme-page.html` içeriği yayında olmalı; dosyada `PROJE_ID` yerine `sbydlcujsiqmifybqzsi` yazın. |
| 3. Edge Function (public-contract) | Deploy edildi mi? | `supabase functions deploy public-contract` ile deploy edin. (Mağaza yönlendirme + app_settings burada.) |
| 4. Admin panel ayarları | Dolduruldu mu? | Admin → Sözleşmeler → **QR URL + Mağaza linkleri** ekranından **Google Play** ve **App Store** URL’lerini girin. İsterseniz orada contract_qr_base_url boş bırakın; .env’deki valoria.app zaten uygulama tarafında kullanılıyor. |

---

## Otel kuralları metni

- **063_valoria_otel_kurallari_content.sql** migration’ı ile veritabanındaki Türkçe sözleşme (version=2) içeriği, gönderdiğiniz “Valoria Hotel – Otel Kuralları” metniyle güncellendi.
- Bu metin **sadece şimdilik** varsayılan; **istediğiniz zaman** değiştirebilirsiniz:
  - **Admin panel** → **Sözleşmeler** → **Kurallar sözleşmesi (7 dil) – Düzenle**
  - Orada başlık ve içeriği düzenleyip “Kaydet ve tüm dillere çevir” ile güncellersiniz; resim ekle butonu da var.

Migration’ı henüz çalıştırmadıysanız: `supabase db push` yapın; 063 çalışınca bu kurallar metni veritabanına yazılır.

---

## Kısa kontrol listesi

1. `supabase db push` (062 + 063).
2. valoria.app’te /sozlesme sayfası yayında ve `PROJE_ID` = `sbydlcujsiqmifybqzsi`.
3. `supabase functions deploy public-contract`.
4. Admin’de Google Play ve App Store URL’lerini doldurma.

Bu dört adım tamamsa sistem, .env’deki `EXPO_PUBLIC_PUBLIC_CONTRACT_URL=https://valoria.app/sozlesme` ile uyumlu çalışır ve sözleşme içeriğini her zaman admin panelden değiştirebilirsiniz.
