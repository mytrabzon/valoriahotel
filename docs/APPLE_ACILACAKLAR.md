# Apple’da Ne Açacaksın? – Kısa Liste

## 1. Hangi siteleri / uygulamayı açacaksın?

| Nerede | Adres | Ne için? |
|--------|--------|----------|
| **Apple Developer** | [developer.apple.com](https://developer.apple.com) | Hesap, sertifika, App ID, Capabilities (NFC, Push vb.) |
| **App Store Connect** | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) | Uygulama kaydı, sürüm, ekran görüntüleri, incelemeye gönderme |
| **Xcode** (Mac’te) | Mac’e yüklü Xcode | Sadece kendi bilgisayarında native build / test için; EAS kullanıyorsan zorunlu değil |

Özet:  
- **Developer** = hesap + teknik ayarlar (App ID, capability’ler).  
- **App Store Connect** = mağaza tarafı (yayın, açıklama, ekran görüntüleri).

---

## 2. Apple Developer’da açacağın özellikler (Capabilities)

Developer hesabına gir → **Certificates, Identifiers & Profiles** → **Identifiers** → **App IDs** → `com.valoria.hotel` (yoksa oluştur).

Bu App ID için **Capabilities** kısmında aşağıdakileri **aç** (✓):

| Özellik | Açıklama | Valoria’da kullanım |
|---------|----------|----------------------|
| **Push Notifications** | Uzaktan bildirim | İleride check-in / oda bildirimi için açık bırak. |
| **NFC Tag Reading** | NFC etiket okuma | Müşteri telefonu NFC’ye değdirdiğinde uygulama açılsın (deep link) için. |
| **NFC Background Tag Reading** | Uygulama kapalıyken NFC | İstersen; “telefonu değdir, uygulama kapalı olsa da açılsın” için. |
| **Sign in with Apple** | Apple ile giriş | İleride “Apple ile giriş” eklersen aç. Şu an zorunlu değil. |
| **Background Modes** | Arka planda çalışma | Konum (geofence) veya Beacon için “Location updates” işaretlenebilir. |

Not: **Konum** ve **Face ID** için ayrı capability işaretlemen gerekmez; sadece `Info.plist` açıklamaları yeterli (Expo `app.json` ile zaten ekli).

---

## 3. App Store Connect’te ne yapacaksın?

| Bölüm | Ne yapacaksın? |
|-------|-----------------|
| **My Apps** | **+** → **New App** → İsim: Valoria Hotel, Bundle ID: `com.valoria.hotel`, SKU: örn. `valoria-hotel-1` |
| **Agreements, Tax, and Banking** | Sözleşmeleri kabul et, vergi formu, banka bilgisi (ücretli uygulama / iç satın alma varsa) |
| **App Information** | Kategori (örn. Travel), gizlilik politikası URL’i |
| **Pricing** | Ücretsiz veya fiyat seç |
| **App Privacy** | Konum, kimlik (Face ID), kullanıcı içeriği vb. ne topladığını formda işaretle |
| **Sürüm (Version)** | Ekran görüntüleri (6.7", 6.5", 5.5" iPhone), açıklama, anahtar kelimeler, “What’s New” |
| **TestFlight** (isteğe bağlı) | Build yükleyip beta testçi davet et |
| **Submit for Review** | İncelemeye gönder |

---

## 4. Özet: Sırayla ne açacaksın?

1. **developer.apple.com** → Üye ol (Apple Developer Program).  
2. **developer.apple.com** → Identifiers → App ID `com.valoria.hotel` → Capabilities: **Push Notifications**, **NFC Tag Reading** (ve istersen **NFC Background Tag Reading**, **Background Modes → Location updates**).  
3. **appstoreconnect.apple.com** → Yeni uygulama oluştur, sözleşme/vergi/banka, store bilgileri ve ekran görüntülerini doldur.  
4. **EAS / build** → `eas build --platform ios` ile build al, **App Store Connect**’e yükle (Upload veya EAS Submit).  
5. **App Store Connect** → İncelemeye gönder (Submit for Review).

Bu liste, “Apple’dan ne açacağım ve başka hangi özellikleri açacağım?” sorusunun cevabı. İstersen bir sonraki adımda sadece “sadece NFC” veya “sadece bildirim” için kısaltılmış liste de çıkarabiliriz.
