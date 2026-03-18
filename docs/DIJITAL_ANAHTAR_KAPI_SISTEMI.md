# Dijital Anahtar ve Kapı Açma Sistemi – Durum ve Kurulum

Bu doküman: sistemin **şu anki durumu**, **veritabanı/panel yapısı** ve **kapıyı telefondan açmak** için gereken adımları anlatır.

---

## 1. Şu an ne çalışıyor, ne çalışmıyor?

| Özellik | Durum | Açıklama |
|--------|--------|----------|
| **Admin: Kapı tanımlama** | ✅ Çalışıyor | Admin → Geçiş Kontrolü → Kapılar. Oda kapıları (Oda 101, 102…) ve ortak alanlar (otopark, havuz, spor, personel) eklenebilir, aktif/pasif yapılabilir. |
| **Admin: Kart tanımlama** | ✅ Çalışıyor | Geçiş Kontrolü → Kart Tanımlama. Seri no, misafir/personel, geçerlilik tarihi, hangi kapılar (veya tüm kapılar) atanır. |
| **Admin: Personel yetkileri** | ✅ Çalışıyor | Hangi personel hangi kapıyı hangi saat/gün açabilsin tanımlanır. |
| **Admin: Kapı logları** | ✅ Sayfa var | Kim ne zaman hangi kapıyı açtı / reddedildi listelenir (veri donanım/API’den gelince dolacak). |
| **Müşteri: Dijital Anahtar ekranı** | ✅ Çalışıyor | Oda, giriş–çıkış, QR’lar + **Kapıyı aç** (oda numarası gir → buton). |
| **Telefonla kapı açma (API)** | ✅ Var (donanım yok) | `open-door` Edge Function: yetki kontrolü + log. Kilit/gateway API çağrısı **placeholder** (ileride bağlanacak). |
| **NFC ile kapı açma** | ❌ Uygulamada yok | NFC app.json veya uygulama kodunda **eklenmedi**; ileride açılırsa aynı open-door API kullanılabilir. |
| **Kilit donanımı entegrasyonu** | ❌ Yok | Hangi marka (Kale, Kaba, Yale vb.) kullanılacak belirlenip “aç” komutunun gateway’e gönderilmesi gerekiyor. |

Özet: **Kapı ve kart tanımlama, yetkiler, log ekranı hazır.** **Telefonla “Kapıyı aç”** (oda no + API) çalışıyor; eksik olan sadece **gerçek kilit/gateway API** entegrasyonu.

---

## 2. Sistem mimarisi (kısaca)

- **doors**  
  Kapılar: oda kapısı (room_id ile), otopark, havuz, spor, personel vb. Her kapının bir `id`’si ve `name` (örn. "Oda 101") var.

- **access_cards**  
  Fiziksel kart (seri no) veya **dijital anahtar** (telefon için token/uid). Bir karta misafir veya personel bağlanır; `valid_from` / `valid_until` ve `all_doors` veya sadece belirli kapılar atanır.

- **card_door_permissions**  
  Hangi kart hangi kapıyı açabilsin (kart–kapı eşleştirmesi).

- **staff_door_permissions**  
  Personel için zamanlı yetki: hangi kapı, hangi saat aralığı, hangi günler.

- **door_access_logs**  
  Her açma denemesi (granted/denied) burada loglanır; raporlama ve güvenlik için.

Kapıyı **telefonla açmak** için akış şöyle olacak:

1. Telefonda “Kapıyı aç” (veya QR/NFC ile tetiklenen) istek → backend’e gider.
2. Backend: kullanıcı/kart geçerli mi, bu kapıya yetkisi var mı, saat/gün uygun mu diye kontrol eder.
3. Yetki varsa **kilit/panel ile konuşan API**’ye “aç” komutu gönderilir.
4. Sonuç `door_access_logs`’a yazılır.

Bu “kilit/panel API’si” sizin satın alacağınız donanıma (akıllı kilit, gateway, okuyucu) bağlıdır; Valoria tarafında sadece **tek bir “kapı aç” endpoint’i** yazılıp bu API’yi oradan çağıracak.

---

## 3. Kapıyı “numara ile” tanımlama (senaryonuz)

“Kapı üzerinden numaralarımı yazacağım, telefon ile açılacak” derseniz iki parça var:

### A) Kapıyı sistemde tanımlama (Admin)

1. **Admin → Geçiş Kontrolü → Kapılar → Yeni kapı**
2. **Ad:** Örn. `Oda 101` (kapıda yazacağınız numara ile aynı olabilir).
3. **Kapı tipi:** Oda (veya Otopark, Havuz vb.).
4. **Oda:** Varsa ilgili odayı seçin (rooms tablosundaki oda ile eşleşir).
5. Kaydedin. Bu kapının bir **UUID**’si (`door_id`) olur; API’de “hangi kapı” derken bu kullanılır.

İsterseniz kapı adını tam olarak **oda numarası** yaparsınız: 101, 102, 103… Böylece hem panelde hem (ileride) uygulamada “101 numaralı kapı” net olur.

### B) Telefonla açma (uygulama + API var; kilit bağlı değil)

- **Uygulama:** Dijital Anahtar ekranında “Kapıyı aç” alanı var. Kullanıcı oda numarasını yazar (veya kendi odasını varsayılan görür), **Kapıyı aç** butonuna basar → `open-door` Edge Function çağrılır.
- **Backend:** `open-door` yetki kontrolü yapar (misafir: check-in + oda eşleşmesi veya kart yetkisi; personel: staff_door_permissions / access_cards), sonucu `door_access_logs`’a yazar. **Kilit/gateway API çağrısı** henüz yok (placeholder); donanım seçildiğinde burada tek satır eklenerek bağlanacak.
- **Kilit tarafı:** Kale, Kaba, Yale vb. bulut/gateway API’si seçilip `open-door` içinde “aç” komutu gönderilecek.

Yani: **“Oda numarası gir → Kapıyı aç” akışı ve API hazır;** sadece **gerçek kilit API’si** bağlanacak.

---

## 4. API açma / kart tanımlama – pratik adımlar

### Kapı ekleme (oda numaralarıyla)

1. Admin panele girin → **Geçiş Kontrolü → Kapılar**.
2. **Yeni kapı** → Ad: `101` (veya `Oda 101`), Tip: Oda, ilgili **room** seçin → Kaydet.
3. Aynı şekilde 102, 103… ekleyin. Her kapının `id`’si (UUID) panelde/listede görünür; API’de bu `door_id` kullanılacak.

### Kart tanımlama (dijital anahtar = telefon)

- **Fiziksel kart:** Kart okuyucuda okutup gelen seri numarayı “Kart Tanımlama”da girin; misafir/personel seçin, geçerlilik ve kapıları atayın.
- **Dijital anahtar (telefon):**  
  Telefonu “kart” gibi kullanmak için, o telefona özel bir **token/seri numara** atanmalı. Örn. `room_qr_codes` veya `access_cards` içinde misafir için bir kayıt: `serial_number` = uygulama tarafından üretilen benzersiz değer (veya mevcut oda token’ı).  
  Şu an check-in sonrası **oda token’ı** var; “kapı aç” API’si yazıldığında bu token ile “bu misafir, bu oda kapısını açabilir” eşleştirmesi yapılabilir. İsterseniz aynı misafir için `access_cards`’a da otomatik kayıt ekleyen bir akış (check-in sırasında) yazılabilir.

### “API açma” derken

- **Dış dünyaya açacağınız API:** “Kapı aç” isteği alan endpoint. Bu, Supabase Edge Function veya kendi sunucunuzda olur; **kimlik doğrulama** (token / API key) ve **yetki kontrolü** (yukarıdaki tablolar) burada yapılır. Kilit tarafına sadece yetkili istekler iletilir.
- **Kart tanımlama:** Admin panelden (Kart Tanımlama) veya ileride yazılacak bir **admin/API** ile `access_cards` ve `card_door_permissions` tablolarına ekleme/güncelleme yapılır. “API ile kart tanımlama” = bu tablolara insert/update yapan bir endpoint demek; istenirse ayrı bir küçük API yazılabilir.

---

## 5. “Kapı aç” API taslağı (open-door Edge Function)

- **Endpoint:** `POST /functions/v1/open-door` (Supabase Edge Function).
- **Kimlik:** `Authorization: Bearer <kullanıcı JWT>` (misafir veya personel oturumu).
- **Body (JSON):**
  - `door_id` (isteğe bağlı): Kapı UUID.
  - `room_number` (isteğe bağlı): Oda numarası (örn. `"101"`). Kapı önce `rooms.room_number` ile odaya, sonra o odaya bağlı kapıya çözülür; yoksa `doors.name` ile aranır.
  - En az biri zorunlu.
- **Yetki:**
  - **Personel:** `staff_door_permissions` veya `access_cards` + `card_door_permissions` (veya kartta `all_doors`) ile bu kapıya yetkisi varsa izin verilir.
  - **Misafir:** Check-in’de (`reservations` / konaklama) ve `guest.room_id === door.room_id` veya bu kapı için `access_cards` + `card_door_permissions` yetkisi varsa izin verilir.
- **Kayıt:** Her deneme `door_access_logs` tablosuna `granted` veya `denied` olarak yazılır.
- **Yanıt:** `{ "success": true|false, "result": "granted"|"denied", "message": "..." }`. 200 döner; reddedilse bile body’de `result: "denied"` olur.
- **Kilit:** Şu an gerçek kilit/gateway çağrısı **yok**. İleride bu fonksiyon içinde yetki ve log’dan sonra seçilen markanın API’sine HTTP “aç” isteği eklenir.

---

## 6. Uygulamada “oda numarası gir → Kapıyı aç” akışı

1. Kullanıcı **Müşteri** uygulamasında **Dijital Anahtar** sekmesine girer.
2. **Kapıyı aç** bloğunda oda numarası alanı görünür (varsayılan: kendi odası).
3. İstediği oda numarasını yazar (veya varsayılanı bırakır) ve **Kapıyı aç** butonuna basar.
4. Uygulama `supabase.functions.invoke('open-door', { body: { room_number: "..." } })` çağrısı yapar (JWT otomatik gider).
5. Sonuç Alert ile gösterilir: “Kapı açıldı” veya “Yetkiniz yok” / “Kapı bulunamadı” vb.
6. Arka planda `door_access_logs` güncellenir; Admin → Kapı loglarından görülebilir.

---

## 7. Kart tanımlama – gelişmiş özellikler

- **Not alanı:** Her karta `notes` (TEXT) eklenebilir: RFID formatı, tedarikçi, kullanım amacı vb. Yeni kart ve kart düzenleme ekranlarında mevcut.
- **Liste filtreleri:** Kart listesinde **Tümü / Aktif / İptal** ve **kart tipi** (Misafir, VIP, Temizlik, Teknik, Güvenlik, Yönetici, Geçici) ile filtreleme.
- **İptal / yeniden aktif:** Kart düzenlemede “Kart aktif” kapatılarak kart iptal edilir; tekrar açılıp “Güncelle” ile yeniden aktif edilebilir (`revoked_at` temizlenir).
- **NFC:** Uygulamada ve app.json’da NFC **yok**; ileride açılırsa aynı `open-door` API ve kart yetkileri kullanılacak.

---

## 8. Özet tablo

| Konu | Durum |
|------|--------|
| Kapı tanımlama (oda numaraları dahil) | ✅ Admin’de yapılıyor. |
| Kart tanımlama (fiziksel/dijital, not, filtre, iptal/yeniden aktif) | ✅ Admin’de yapılıyor. |
| Personel kapı yetkileri | ✅ Var. |
| Kapı logları ekranı | ✅ Var (open-door ile doluyor). |
| Telefonla kapı açma (API + oda no + buton) | ✅ Var (kilit donanımı bağlı değil). |
| Kilit markası / gateway API entegrasyonu | ❌ Yok; open-door içine eklenecek. |
| NFC ile açma | ❌ Uygulamada yok; altyapı hazır. |

**Sonraki adım:** Kilit/gateway markası ve API’si belirlenip `open-door` Edge Function içinde “aç” komutu eklenecek.
