# Sözleşme, QR URL ve Mağaza Yönlendirme Sistemi

## 1. Admin panelden yapılabilecekler

### Sözleşme içeriği (Kurallar – Düzenle)
- **Sınırsız karakter:** Metin/HTML sınırsız (veritabanı TEXT).
- **HTML kullanımı:** `<h3>`, `<p>`, `<a href="...">` vb. doğrudan yazılabilir.
- **Resim ekleme:** "📷 Resim ekle" butonu ile galeriden resim seçilir; `contract-media` storage’a yüklenir ve içeriğe `<img>` olarak eklenir. Kodla uğraşmadan sözleşmeyi güncelleyebilirsiniz.

### QR ve mağaza ayarları (QR URL + Mağaza linkleri)
- **Sözleşme onay sayfası base URL:** QR’da kullanılacak adres (örn. `https://valoria.app/sozlesme`). Boş bırakılırsa Supabase function URL’i kullanılır.
- **Check-in QR base URL:** Oda/check-in QR’larında kullanılacak base URL. Boş = varsayılan.
- **Google Play URL:** Android’de sözleşme onayı sonrası yönlendirilecek uygulama sayfası.
- **App Store URL:** iOS’ta sözleşme onayı sonrası yönlendirilecek uygulama sayfası.

### Sözleşme onayları – Oda ataması
- Web’den sözleşme onayı yapanlar listelenir (oda, tarih, dil).
- "Misafir / Oda işlemleri" ile misafir listesine gidilir; admin oda ataması veya misafir kaydı yapar.

---

## 2. Sözleşme onayı sonrası mağaza yönlendirme

- Onay tamamlanınca sayfada "Uygulamayı indirin" bölümü çıkar.
- **Android** (User-Agent’ta Android): Yaklaşık 2,5 saniye sonra otomatik olarak **Google Play** URL’ine yönlendirilir (ayarlarda doldurulduysa).
- **iOS** (iPhone/iPad/iPod): Aynı şekilde **App Store** URL’ine yönlendirilir.
- Her iki mağaza için butonlar da gösterilir; kullanıcı isterse manuel tıklayabilir.

---

## 3. Veritabanı ve depolama

- **app_settings:** `google_play_url`, `app_store_url`, `contract_qr_base_url`, `checkin_qr_base_url` (admin’den düzenlenir).
- **contract-media:** Sözleşme metnine eklenen resimler; public okuma, sadece authenticated yükleme.

---

## 4. Yapmanız gerekenler

1. **Migration:** `062_app_settings_and_contract_media.sql` migration’ını çalıştırın (`supabase db push` veya manuel).
2. **Edge Function:** `public-contract` function’ını deploy edin (mağaza yönlendirmesi burada).
3. **Admin panelde:**  
   - Sözleşmeler → **QR URL + Mağaza linkleri** ekranından Google Play ve App Store linklerini girin.  
   - İsteğe bağlı: Sözleşme/check-in QR base URL’lerini girin (örn. valoria.app/sozlesme).
4. Sözleşme metnini **Kurallar – Düzenle** ekranından güncelleyin; resim eklemek için "Resim ekle" butonunu kullanın.

Bu yapı ile sözleşmeyi kod yazmadan, sınırsız metin ve resimle güncelleyebilir; QR adreslerini ve mağaza linklerini tek yerden yönetebilirsiniz.
