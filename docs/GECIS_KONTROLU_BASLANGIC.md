# Valoria Hotel – Geçiş Kontrolü: Başlangıç Yapılacaklar

Bu doküman, **kodsuz plandaki** kartlı geçiş sistemini projede hayata geçirmek için adım adım yapılacakları listeler.

---

## 1. Veritabanı (Tamamlandı)

- Migration `004_access_control_schema.sql` eklendi:
  - **doors** – Kapılar (oda + otopark, havuz, spor, personel)
  - **access_cards** – Kartlar (seri no, tip, misafir/personel, geçerlilik)
  - **card_door_permissions** – Kart–kapı yetkileri
  - **staff_door_permissions** – Personel kapı yetkileri (saat/gün)
  - **door_access_logs** – Açılma logları

**Yapmanız gereken:** Supabase’de migration’ı çalıştırın:
```bash
npx supabase db push
# veya Supabase Dashboard > SQL Editor’de 004_...sql dosyasını çalıştırın
```

---

## 2. Donanım / Entegrasyon

- Kapı okuyucuları (RFID/NFC) ve kilitler seçin (Xenon Doors, Kale, Kaba, vb.).
- Merkezi panel/gateway ile kapıların sunucu/API ile nasıl konuşacağını netleştirin.
- Gerçek “kapı açma” komutu donanım API’sine göre yazılacak (Edge Function veya backend).

---

## 3. Admin Panel (İskelet Hazır)

- **Geçiş Kontrolü** menüsü eklendi: Panel → Geçiş Kontrolü.
- Alt sayfalar (şu an placeholder):
  - **Kapılar** – Kapı listesi, oda kapıları ekleme (101–118), ortak alanlar.
  - **Kart Tanımlama** – Kart okut, oda/personel seç, geçerlilik + kapı yetkileri.
  - **Personel Yetkileri** – Hangi personel hangi kapıyı hangi saatte açacak.
  - **Kapı Logları** – Açılma kayıtları, yetkisiz denemeler, rapor.

**Yapılacak:** Bu sayfaları Supabase’deki `doors`, `access_cards`, `staff_door_permissions`, `door_access_logs` tablolarına bağlayacak liste/form ve API çağrıları yazılacak.

---

## 4. Müşteri Uygulaması – Dijital Anahtar (İskelet Hazır)

- **Dijital Anahtar** sekmesi eklendi: Müşteri uygulaması → “Dijital Anahtar”.
- Ekranda: Oda, giriş–çıkış, “telefonu yaklaştır / QR / Bluetooth” alanları (şu an statik).

**Yapılacak:**

- Check-in yapmış misafiri tespit et (ör. `guests` + `room_id` + `status = 'checked_in'`).
- Bu misafire ait **access_cards** kaydı (dijital anahtar) check-in sırasında veya otomatik oluşturulsun.
- Dijital anahtar ekranında oda, giriş–çıkış ve geçerlilik API’den gelsin.
- NFC / QR / Bluetooth ile açma: Cihazdan gelen token veya kart eşdeğeri, backend/Edge Function’da doğrulanıp kapı açma komutu gönderilsin.

---

## 5. İş Akışları (Plandaki Adımlar)

| Durum | İşlem | Nerede kullanılacak |
|--------|--------|----------------------|
| Yapılacak | Yeni misafir check-in → oda atanır → kart/dijital anahtar otomatik tanımlanır | Admin check-in + müşteri uygulaması |
| Yapılacak | Personel işe başlar → admin personel yetkisi + kart tanımlar | Admin: Personel Yetkileri + Kart Tanımlama |
| Yapılacak | Kart kayboldu → admin kart iptal → yeni kart tanımla | Admin: Kart Tanımlama (iptal + yeni) |
| Yapılacak | Kapı açılma anında log yaz (donanım/gateway’den gelen event veya API çağrısı) | `door_access_logs` + Admin: Kapı Logları |

---

## 6. Özet

- Veritabanı şeması ve admin/müşteri iskeleti eklendi.
- Sıradaki adımlar: migration’ı çalıştırmak, admin sayfalarını veriye bağlamak, dijital anahtar için check-in ve yetki kontrolünü yazmak, donanım/gateway API’si ile kapı açma ve log yazmayı entegre etmek.

Bu liste, plandaki **“Başlangıç için yapılacaklar”** bölümünü proje koduna göre somutlaştırır.
