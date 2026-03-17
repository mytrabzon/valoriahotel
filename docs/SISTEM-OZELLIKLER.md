# Valoria Hotel – Sistem ve Özellikler (Müşteri, Çalışan, Admin)

Bu dokümanda uygulamanın tüm kullanıcı tipleri, ekranlar ve özellikler tek listede toplanmıştır.

---

## 1. Genel yapı

- **Uygulama:** React Native (Expo), tek kod tabanı – Android & iOS.
- **Backend:** Supabase (Auth, PostgreSQL, Realtime, Storage).
- **Giriş noktası:** Karşılama ekranı (lobi) – 4 seçenek: Müşteri, Personel, Yönetici (sadece tek admin), E-posta.

---

## 2. Karşılama ekranı (Lobi – herkese açık)

- **VALORIA HOTEL** – Lüksün ve konforun adresi.
- **4 kart:**
  1. **Müşteri girişi** → Sözleşme onayı (gerekirse) → Müşteri uygulaması. Alt link: QR ile sözleşme onayı (misafir akışı).
  2. **Personel girişi** → Admin/Personel giriş ekranı (e-posta + şifre). Giriş yapan `role !== 'admin'` ise **Personel** paneline, `role === 'admin'` ise **Admin** paneline yönlendirilir.
  3. **Yönetici girişi** → Sadece **tek yetkili admin** hesabında görünür (sonertoprak97@gmail.com). Tıklanınca yine admin giriş ekranına gider; sadece bu hesap admin paneline erişir.
  4. **E-posta girişi** → Magic link / 6 haneli kod veya şifre ile giriş/kayıt ekranı.
- **Çevrimdışı:** İnternet yoksa “Çevrimdışı mod” mesajı ve “Yeniden dene” butonu.
- **Footer:** Antalya / Türkiye, 5 Yıldız; Gizlilik, Kullanım koşulları, Dil linkleri.

---

## 3. Müşteri (Customer)

**Kim:** E-posta ile giriş yapan veya kayıt olan konuk. Karşılama ekranından “Müşteri girişi” veya “E-posta girişi” ile gelir (sözleşme onayı sonrası `/customer`).

**Özellikler:**

| Özellik | Açıklama |
|--------|----------|
| **Ana sayfa** | Hoş geldin, otel adı, arama alanı, hızlı kategoriler (Mesajlar, Odalar, Dijital Anahtar, Otel, Destek). “Sana özel”: öne çıkan personel + otel hakkında kart. Aktif çalışanlar listesi. |
| **Mesajlar** | Personel ile anlık sohbet. Sohbet listesi, yeni sohbet, mesaj/medya gönderme. |
| **Odalar** | Odalarım / rezervasyon bilgisi (liste ekranı). |
| **Harita** | Uygulama içi harita: restoran, kafe, otel, eczane, hastane, jandarma; arama/filtre; yakındakiler; yol tarifi ve işletme detayı (telefon, web) uygulama içi (Google Maps'e yönlendirme yok). |
| **Dijital Anahtar** | NFC ile kapı açma (cihaz destekliyorsa). Oda bilgisi, check-in/out tarihleri. |
| **Otel** | Otel hakkında, açıklama, “Devamını oku”. |
| **Destek** | Aktif personel listesi; birini seçip sohbet başlatma. |
| **Bildirimler** | Bildirim listesi, okundu işaretleme. |
| **Profil** | Hesap bilgisi, yasal sayfalar (gizlilik, koşullar, çerezler), iletişim (support@valoriahotel.com). |

**Sekmeler:** Ana Sayfa, Mesajlar, Odalar, Harita, Bildirimler, Profil. Dijital Anahtar sekme çubuğunda gizli (href: null), menüden erişilir.

**Canlı akış (Instagram tarzı):**
- Ana sayfada **aktif çalışanlar** story avatar olarak (yatay kaydırma, durum rengi: 🟢 aktif, 🟡 molada, 🔴 çıktı, ⚪ izinli).
- **Otel hakkında** kartı (konum, yıldız, tesisler, detaylı bilgi).
- **Oda bilgilerim** (check-in’li misafir için): oda no, giriş/çıkış, Dijital Anahtar, Temizlik iste.
- **Personele mesaj gönder**: listeden personel seçip doğrudan sohbet.
- **Personellerden paylaşımlar**: personel paylaşım yaparken “Müşteri ana sayfasında da görünsün” seçerse bu bölümde listelenir; foto/video, başlık ve yazar (personel adı) gösterilir.

---

## 4. Misafir (Guest) – QR ile giriş

**Kim:** Oda QR kodu veya NFC/deep link ile gelen, henüz müşteri hesabı olmayan misafir. Sözleşme onayı ve check-in akışını tamamlar.

**Akış (sırayla):**

| Adım | Ekran | Açıklama |
|------|--------|----------|
| 1 | **QR okut** (`/guest` veya `/guest/index`) | Oda QR kodu taranır; token geçerliyse `room_id` ve oda numarası alınır, akış başlar. |
| 2 | **Dil seçimi** (`/guest/language`) | Sözleşme ve form dili seçilir. |
| 3 | **Sözleşme** (`/guest/contract`) | Konaklama sözleşmesi metni okunur, onaylanınca forma geçilir. |
| 4 | **Form** (`/guest/form`) | Misafir bilgileri (ad, soyad, kimlik, vb.) doldurulur. |
| 5 | **Doğrulama** (`/guest/verify`) | Girilen bilgiler özetlenir, doğrula → imza ekranına geçilir. |
| 6 | **İmza** (`/guest/sign`) | Ekranda imza atılır, onaylanır. |
| 7 | **Başarı** (`/guest/success`) | “Check-in tamamlandı” mesajı, ardından ana lobiye yönlendirilir. |

Deep link: `valoria://guest?token=...` veya `valoria://checkin/roomId`. Lobi’de “QR ile sözleşme onayı” veya “Müşteri girişi” kartındaki QR linki de misafir akışına gidebilir (politika onayı sonrası).

---

## 5. Personel (Staff – Çalışan)

**Kim:** `staff` tablosunda kayıtlı, `role !== 'admin'` olan kullanıcı (receptionist, housekeeping, vb.). Karşılama ekranından “Personel girişi” ile admin giriş ekranına gider; giriş sonrası otomatik **Personel** paneline yönlendirilir.

**Özellikler:**

| Özellik | Açıklama |
|--------|----------|
| **Ana sayfa** | Hoş geldin, hızlı işlemler: Stok Girişi (barkod okut / ürün seç), Profilim, Bildirimler. |
| **Stok** | Stok girişi ekranı (`/staff/stock/entry`): barkod okutma veya manuel ürün seçimi, miktar, fotoğraf (isteğe bağlı). Barkod okutma ekranı (`/staff/stock/scan`). |
| **Profil** | Çalışan profili: ad, departman, fotoğraf, bio, uzmanlık, diller, çevrimiçi durumu, vb. düzenleme. |
| **Bildirimler** | Personel bildirimleri listesi, okundu işaretleme. |
| **Ekip sohbeti** | Mesaj listesi → sohbet detayı (metin + sesli mesaj). Personel–personel ve personel–misafir sohbetleri. |
| **Ekip paylaşımları** | Foto/video paylaşım akışı (all_staff / my_team). **Yeni paylaşım**: kamera/galeri, başlık, görünürlük (tüm personel, ekibim, yöneticiler, **müşteri ana sayfasında da görünsün**). Ana sayfada seçip paylaşırken müşteri ana sayfasında da görünmesi seçilebilir. |
| **Stok girişi** | Barkod okut veya ürün seç (mevcut stok ekranı). |

**Canlı akış ana sayfa:** Aktif çalışanlar (story avatar, “Sen” + diğerleri), görevlerim (housekeeping linki), aktif müşteriler (avatar + oda), ekip sohbeti önizleme, ekip paylaşımları, stok girişi.

**Erişemez:** Admin panele (oda yönetimi, misafirler, check-in, housekeeping, sözleşmeler, stok onayları, geçiş kontrolü, toplu bildirim/mesaj, vb.) sadece `role === 'admin'` erişir.

---

## 6. Yönetici (Admin)

**Kim:** `staff` tablosunda `role === 'admin'` olan tek hesap (şu an: sonertoprak97@gmail.com). Karşılama ekranında “Yönetici girişi” sadece bu hesapta görünür; “Personel girişi” herkeste görünür ama admin olmayan personel giriş yapınca `/staff`’a düşer.

**Giriş:** Admin giriş ekranı (`/admin/login`) – e-posta + şifre; isteğe bağlı Apple ile giriş, “E-posta kodu / Magic link”, “Şifremi unuttum” linkleri.

**Panel (Ana menü – `/admin`):**

| Modül | Sayfalar | Açıklama |
|-------|----------|----------|
| **Oda yönetimi** | Odalar listesi, oda detay, yeni oda | Oda ekleme/düzenleme, QR kod, durum (available, occupied, cleaning, maintenance, out_of_order). |
| **Misafirler** | Misafir listesi, misafir detay | Onay bekleyen ve kayıtlı misafirler, detay, notlar. |
| **Check-in / Check-out** | Check-in ekranı | Oda atama, giriş-çıkış işlemleri. |
| **Oda durumu (Housekeeping)** | Housekeeping ekranı | Temizlik / bakım durumu güncelleme. |
| **Sözleşme yönetimi** | Sözleşmeler listesi, kurallar (7 dil) | Şablonlar, çoklu dil içerik. |
| **Stok yönetimi** | Stok ana sayfa, hareket (giriş/çıkış), onay bekleyenler, barkod okut | Ürünler, giriş/çıkış, onay akışı, barkod tarama. |
| **Geçiş kontrolü** | Geçiş ana sayfa, kapılar, kart tanımlama, personel yetkileri, kapı logları | Kapılar, kartlar, personel-kapı yetkileri, erişim logları. |
| **Bildirim sistemi** | Bildirimler listesi, toplu bildirim, şablonlar, acil durum | Toplu duyuru, acil bildirim, şablon yönetimi. |
| **Mesajlaşma** | Sohbet listesi, sohbet detay, yeni sohbet, toplu mesaj | Misafir ve personelle anlık sohbet, toplu mesaj. |
| **Profilim** | Staff profil sayfasına link | Çalışan profili (fotoğraf, aktif durum vb.). |

**Çıkış:** Panelden çıkış → lobi (`/`).

**Admin push bildirimleri (telefona gelen bildirimler):**
- Admin hesabı açık olan cihazda Expo push token girişte kaydedilir (`push_tokens` + `staff_id`). Aşağıdaki olaylar gerçekleştiğinde **tüm aktif admin hesaplarına** push gönderilir (Edge Function: `notify-admins`).

| Olay | Bildirim başlığı | Tıklanınca açılan sayfa |
|------|-------------------|---------------------------|
| Acil durum (misafir panik butonu) | 🆘 Acil durum | `/admin/notifications/emergency` |
| Yeni personel başvurusu | 📋 Yeni personel başvurusu | `/admin/staff/pending` |
| Stok hareketi onay bekliyor (personel girişi) | 📦 Stok onay bekliyor | `/admin/stock/approvals` |
| Yeni oda servisi siparişi | 🍽️ Yeni oda servisi siparişi | `/admin` |
| Misafirden yeni mesaj (metin veya sesli) | 💬 Yeni misafir mesajı | `/admin/messages` |

Bildirime tıklanınca `data.url` ile ilgili admin ekranına yönlendirilir; böylece admin panel açık olan telefonda anında haberdar olur.

**Admin canlı akış ana sayfa:**
- **Özet:** Doluluk (dolu/toplam oda, %), aktif müşteri sayısı, aktif personel, onay bekleyen stok, okunmamış mesaj.
- **Tüm kullanıcılar:** Aktif personel ve aktif müşteriler (avatar listesi).
- **Canlı akış:** Tüm feed paylaşımları (kim, başlık, saat).
- **Tüm mesajlaşmalar** → Mesajlar modülü.
- **Onay bekleyenler** → Stok onayları.
- **Hızlı işlemler:** Duyuru gönder, Misafirler, Oda ekle, Rapor al + mevcut menü linkleri.

---

## 7. Kimlik doğrulama (Auth)

| Yöntem | Ekran / Akış | Açıklama |
|--------|----------------|----------|
| **E-posta + magic link / kod** | `/auth` → kod gönder → `/auth/code` | 6 haneli kod veya magic link; callback’te oturum açılır, staff ise admin’e, değilse customer’a yönlendirilir. |
| **E-posta + şifre** | `/auth/password` | Giriş veya kayıt (signUp parametresi). |
| **Şifremi unuttum** | `/auth/reset` | Şifre sıfırlama e-postası. |
| **Personel / Admin girişi** | `/admin/login` | E-posta + şifre (ve isteğe bağlı Apple). Staff kaydı yoksa “Yetkisiz”. Varsa `role === 'admin'` → admin panel, `role !== 'admin'` → personel panel. |

**Redirect:** Magic link / callback sonrası: staff → `/admin`, değilse → `/customer`. Deep link scheme: `valoria://auth/callback`.

---

## 8. Yetkilendirme özeti

| Kullanıcı tipi | Nasıl girer? | Nereye gider? |
|----------------|--------------|----------------|
| **Müşteri** | Lobi → Müşteri girişi veya E-posta girişi (e-posta ile) | Sözleşme (gerekirse) → `/customer` (Ana sayfa, Mesajlar, Odalar, Anahtar, Otel, Bildirimler, Profil). |
| **Misafir (QR)** | Lobi → QR ile sözleşme onayı veya QR/NFC ile direkt | Sözleşme onayı (gerekirse) → `/guest` akışı (dil → sözleşme → form → doğrulama → imza → başarı). |
| **Personel** | Lobi → Personel girişi → admin login ekranı | Giriş sonrası `/staff` (Ana sayfa, Stok girişi, Profil, Bildirimler). |
| **Yönetici (Admin)** | Lobi → Yönetici girişi (sadece tek admin hesabında görünür) veya Personel girişi → admin login | Giriş sonrası `/admin` (tüm panel: odalar, misafirler, check-in, housekeeping, sözleşmeler, stok, geçiş, bildirimler, mesajlar). |

---

## 9. Teknik notlar

- **Tek admin:** `SOLE_ADMIN_UID` (sonertoprak97@gmail.com). Lobi’de “Yönetici girişi” sadece bu hesap giriş yapmışken görünür; admin panele sadece `staff.role === 'admin'` erişir.
- **Veritabanı:** Supabase (PostgreSQL). Önemli tablolar: `staff`, `guests`, `rooms`, `room_qr_codes`, `contracts`, `notifications`, `messages`, `conversations`, `pois`, `poi_reviews`, stok ve geçiş tabloları. Migration’lar `supabase/migrations/` altında.
- **Harita:** Mapbox (token varsa) veya OSM tile; POI karma: önce Supabase `pois`, yoksa Overpass API; yol tarifi OSRM (uygulama içi); telefon/web tıklanabilir.
- **Build:** EAS (Expo Application Services). Profiller: `development`, `preview`, `production`. Geliştirme için Metro’ya bağlanarak canlı güncelleme; dağıtım için build alınıp APK/IPA kurulur.

Bu doküman, müşteri / çalışan / admin ve misafir akışlarının tam listesidir; ekran adları ve route’lar mevcut uygulama yapısına göredir.

**İleride eklenebilecek özellik fikirleri için:** [EKLENEBILECEK-OZELLIKLER.md](./EKLENEBILECEK-OZELLIKLER.md)
