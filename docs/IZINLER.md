# Valoria Hotel – Kullanıcıdan İstenen İzinler

Uygulama aşağıdaki izinleri kullanır. iOS’ta her izin için kullanıcıya gösterilen açıklama metni de belirtilmiştir.

---

## iOS (infoPlist açıklamaları)

| İzin | Kullanıcıya gösterilen metin | Nerede kullanılıyor? |
|------|------------------------------|----------------------|
| **Kamera** | "Sözleşme onayı için QR kod okutmanız gerekiyor." | QR kod okutma, check-in / sözleşme akışı |
| **Fotoğraf Galerisi** | "Profil ve belge yükleme için galeri erişimi." | Profil fotoğrafı, belge (kimlik vb.) yükleme |
| **Konum (uygulama kullanılırken)** | "Otele yaklaştığınızda check-in bildirimi göstermek için konum kullanılır." | Harita, otel yakınına gelince bildirim |
| **Konum (her zaman)** | "Otel bölgesine girdiğinizde otomatik hoş geldiniz bildirimi için konum kullanılır." | Arka planda geofence (otel bölgesi) |
| **Face ID** | "Sözleşme onayında kimlik doğrulama için Face ID kullanılır." | Sözleşme / güvenli onay (biyometrik) |
| **NFC** | "Dijital anahtar ile kapıyı açmak için NFC kullanılır." | Dijital anahtar, kapı okuyucusu ile etkileşim |

---

## Android (izinler)

| İzin | Açıklama | Nerede kullanılıyor? |
|------|----------|----------------------|
| **CAMERA** | Kamera | QR okutma, fotoğraf çekme |
| **ACCESS_FINE_LOCATION** | Hassas konum | Harita, otel yakınında bildirim |
| **ACCESS_BACKGROUND_LOCATION** | Arka planda konum | Otel bölgesine girince arka planda bildirim (geofence) |
| **USE_BIOMETRIC** | Biyometrik (parmak izi / yüz) | Sözleşme onayı, güvenli giriş |
| **USE_FINGERPRINT** | Parmak izi (eski API) | Eski cihazlarda biyometrik |
| **NFC** | NFC | Dijital anahtar ile kapı açma |

Android’de bu izinler için **runtime** (çalışma anında) onay istenebilir; kullanıcı reddederse ilgili özellik devre dışı kalır (örn. konum kapalıysa geofence çalışmaz).

---

## Özet liste (kullanıcıya söylenebilecek ifade)

1. **Kamera** – QR kod okutma ve fotoğraf çekme  
2. **Fotoğraf galerisi** – Profil ve belge yükleme  
3. **Konum** – Harita ve otel yakınında bildirim  
4. **Biyometrik (Face ID / parmak izi)** – Sözleşme onayında güvenli doğrulama  
5. **NFC** – Dijital anahtar ile kapı açma  

Bu izinler `app.json` içinde tanımlıdır; build alındığında otomatik olarak uygulamaya eklenir.

---

## Reklam / analitik yok

Uygulamada **reklam**, **analitik** veya **izleme (tracking)** için hiçbir izin veya SDK kullanılmıyor. `app.json` içinde reklam/analiz amaçlı ek bir ayar veya plugin **yoktur** ve **eklenmeyecektir**.
