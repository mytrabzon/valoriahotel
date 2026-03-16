# NFC, Beacon ve UWB Kurulum Rehberi

## 1. NFC (Yakın Alan İletişimi) – Temassız

### Uygulamada ne var?
- **Deep link:** NFC etiketine yazılan URL ile uygulama açılır, sözleşme akışı başlar.
- **Scheme:** `valoria-hotel://guest?token=ODA_TOKEN`
- Etiket bu URL ile yazıldığında müşteri telefonu değdirdiğinde uygulama açılır ve token ile check-in sayfasına gider.

### Sizin yapacaklarınız
1. **NFC okuyucu/yazıcı** alın (resepsiyon için).
2. **NFC etiketleri** (NTAG213/215/216) alın.
3. Admin panelden her oda için QR token üretin; aynı token ile NFC URL’i:
   - `valoria-hotel://guest?token=BURAYA_TOKEN`
4. NFC yazıcı uygulamasıyla (örn. NXP TagWriter) etikete bu URL’i yazın.
5. Resepsiyonda müşteri telefonu etikete değdirdiğinde uygulama açılır (uygulama yüklüyse).

### NFC’si olmayanlar
- QR kod yedek olarak kalsın (mevcut akış).

---

## 2. iBeacon / Bluetooth Beacon – Odaya girince otomatik

### Uygulamada ne var?
- **Şu an:** Sadece altyapı yok; native Beacon API (iOS/Android) için **development build** ve ek kütüphane gerekir (Expo Go’da çalışmaz).
- **Öneri:** `react-native-beacons-manager` veya `expo-beacon` (varsa) ile ayrı bir modül eklenebilir.

### Sizin yapacaklarınız
1. **Beacon cihazları** alın (ör. Estimote, Kontakt.io; oda kapılarına).
2. UUID + major/minor ayarlayın (oda bazlı).
3. Geliştirme: Development build (`npx expo run:ios` / `run:android`) + Beacon kütüphanesi eklenmeli.
4. Mantık: Beacon bölgesine girince bildirim “Odanız 102 – Check-in yapmak ister misiniz?” → tıklayınca sözleşme açılır.

### Maliyet
- Beacon: yaklaşık 5–10 USD/cihaz, pil 2–3 yıl.

---

## 3. UWB (Ultra Wide Band) – Hassas konum

### Uygulamada ne var?
- **Şu an:** Yok. UWB için tamamen **native** modül gerekir (Expo’da hazır çözüm yok).
- iPhone 11+, Samsung S21+ UWB destekler.

### Sizin yapacaklarınız
1. **UWB okuyucu** (kapıya) – donanım tedarikçisi ile çalışın.
2. Yazılım tarafı: Native (Swift/Kotlin) veya React Native için UWB kütüphanesi araştırılmalı.
3. Akış: Telefon kapıya yaklaşınca (10 cm hassasiyet) kapı kilidi açılır / sözleşme onayı tetiklenir.

### Maliyet
- Okuyucu: ~2000 ₺+ (cihaza göre değişir).

---

## 4. Biyometrik (Parmak izi / Yüz) – Uygulamada var

- **İmza ekranında:** “Parmak izi / Face ID ile onayla” butonu var.
- Cihazda parmak izi veya Face ID kayıtlıysa sözleşme bu yöntemle onaylanabilir.
- Ek donanım gerekmez; sadece kullanıcı izni gerekir.

---

## 5. Konum (Geolocation) – Uygulamada var

- **Otel koordinatları** .env’de tanımlanınca: `EXPO_PUBLIC_HOTEL_LAT`, `EXPO_PUBLIC_HOTEL_LON`
- Müşteri otele ~500 m yaklaşınca “Check-in yapmak ister misiniz?” bildirimi çıkar.
- Konum izni (Always veya When In Use) gerekir.

### .env örneği
```env
EXPO_PUBLIC_HOTEL_LAT=41.0082
EXPO_PUBLIC_HOTEL_LON=28.9784
```

---

## Özet tablo

| Teknoloji   | Uygulamada durum        | Sizin yapmanız gereken                          |
|------------|--------------------------|-------------------------------------------------|
| NFC        | Deep link hazır          | Etiket + yazıcı, URL’i etikete yazma            |
| Beacon     | Yok (ek geliştirme gerek)| Beacon cihazları + dev build + kütüphane        |
| UWB        | Yok                      | Native geliştirme + UWB okuyucu donanımı       |
| Biyometrik | Var (imza ekranı)        | Yok                                             |
| Konum      | Var (geofence)           | .env’e otel koordinatlarını yazma               |
