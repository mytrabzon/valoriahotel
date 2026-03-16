# Valoria Hotel – URL ve Deep Link Yapılandırması

Bu dokümanda **Supabase Auth (Site URL & Redirect URLs)** ve **uygulama deep link** ayarları tek yerde toplanmıştır.

---

## 1. Supabase Auth – Site URL

**Authentication → URL Configuration → Site URL** alanına şunlardan birini yazın:

| Ortam | Site URL |
|--------|----------|
| **Canlı (production)** | `https://litxtech.com` |
| **Alternatif domain** | `https://www.valoriahotel.com` (kendi domain’iniz varsa) |

- Varsayılan yönlendirme ve e-posta şablonlarındaki linkler bu adresi kullanır.
- Wildcard kullanılamaz; tek bir tam URL olmalı.

---

## 2. Supabase Auth – Redirect URLs (eklenecek tüm URL’ler)

**Authentication → URL Configuration → Redirect URLs** bölümüne aşağıdaki satırları **tek tek “Add URL”** ile ekleyin.

### 2.1. Web (litxtech.com)

```
https://litxtech.com
https://litxtech.com/
https://litxtech.com/**
https://www.litxtech.com
https://www.litxtech.com/
https://www.litxtech.com/**
```

### 2.2. Auth callback path’leri (Supabase e-posta / OAuth dönüşü)

E-posta onayı, şifre sıfırlama veya OAuth (Google/Apple vb.) web’de açılıyorsa:

```
https://litxtech.com/auth/callback
https://litxtech.com/auth/confirm
https://litxtech.com/auth/reset-password
https://www.litxtech.com/auth/callback
https://www.litxtech.com/auth/confirm
https://www.litxtech.com/auth/reset-password
```

### 2.3. Mobil uygulama – Deep link (custom scheme)

Valoria Hotel uygulaması `valoria-hotel` scheme kullanıyor. Auth sonrası mobilde bu scheme ile açılacaksa:

```
valoria-hotel://
valoria-hotel://**
valoria-hotel://auth/callback
valoria-hotel://guest
valoria-hotel://checkin
```

### 2.4. Expo (geliştirme / preview)

Yerel ve ağ üzerinden Expo ile test için:

```
exp://localhost:8081
exp://localhost:8081/--
exp://127.0.0.1:8081
http://localhost:8081
```

IP’yi kendi bilgisayarınızın IP’si ile değiştirerek (ör. 192.168.1.10):

```
exp://192.168.1.10:8081
exp://192.168.1.10:8081/--
```

### 2.5. Özet liste (kopyala-yapıştır)

Supabase’e ekleyeceğiniz tüm Redirect URL’ler (satır satır):

```
https://litxtech.com
https://litxtech.com/
https://litxtech.com/**
https://www.litxtech.com
https://www.litxtech.com/
https://www.litxtech.com/**
https://litxtech.com/auth/callback
https://litxtech.com/auth/confirm
https://litxtech.com/auth/reset-password
https://www.litxtech.com/auth/callback
https://www.litxtech.com/auth/confirm
https://www.litxtech.com/auth/reset-password
valoria-hotel://
valoria-hotel://**
valoria-hotel://auth/callback
valoria-hotel://guest
valoria-hotel://checkin
exp://localhost:8081
exp://localhost:8081/--
http://localhost:8081
```

---

## 3. Deep link – Scheme ve URL’ler

### 3.1. Scheme (app.json’da tanımlı)

- **Scheme:** `valoria-hotel`
- **Tam örnek:** `valoria-hotel://`

`app.json` içinde zaten vardır:

```json
"scheme": "valoria-hotel"
```

### 3.2. Kullanılan deep link formatları

| Amaç | URL formatı | Örnek |
|------|-------------|--------|
| Check-in (token ile) | `valoria-hotel://guest?token=<TOKEN>` | `valoria-hotel://guest?token=abc123def456` |
| Check-in (oda ID ile) | `valoria-hotel://checkin/<ROOM_UUID>` | `valoria-hotel://checkin/a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

Bu URL’ler:

- QR kod içinde kullanılabilir.
- NFC etiketine yazılabilir.
- E-posta / SMS ile gönderilebilir.
- Web sayfasında “Uygulamada aç” butonu ile kullanılabilir.

### 3.3. Deep link örnekleri (gerçek token/ID ile test)

```
valoria-hotel://guest?token=YOUR_ROOM_QR_TOKEN
valoria-hotel://checkin/YOUR_ROOM_UUID
```

---

## 4. Deep link’in cihazda çalışması için

### 4.1. iOS

- **Associated Domains** (Universal Links) kullanacaksanız:  
  `app.json` → `ios.associatedDomains` eklenmeli (ör. `applinks:litxtech.com`).
- Sadece **custom scheme** (`valoria-hotel://`) kullanacaksanız ek bir domain ayarı gerekmez; scheme yeterli.

### 4.2. Android

- **Intent filter** Expo tarafından `scheme: "valoria-hotel"` ile otomatik eklenir.
- Eğer **App Links** (https ile açılsın) istiyorsanız, `android.intentFilters` ve `assetlinks.json` gerekir (ayrı dokümanda anlatılabilir).

### 4.3. Test

- **Android:**  
  `adb shell am start -a android.intent.action.VIEW -d "valoria-hotel://guest?token=test123"`
- **iOS Simulator:**  
  Terminal: `xcrun simctl openurl booted "valoria-hotel://guest?token=test123"`
- **Gerçek cihaz:**  
  Safari/Chrome adres çubuğuna `valoria-hotel://guest?token=test123` yazıp Enter.

---

## 5. Özet checklist

- [ ] Supabase **Site URL:** `https://litxtech.com` (veya production domain’iniz).
- [ ] **Redirect URLs** listesine yukarıdaki tüm web, auth callback ve `valoria-hotel://` URL’lerini ekleyin.
- [ ] Geliştirme için `exp://localhost:8081` ve gerekirse kendi IP’nizi ekleyin.
- [ ] Uygulama `scheme: "valoria-hotel"` ile derlendiğinden deep link’ler `valoria-hotel://guest?token=...` ve `valoria-hotel://checkin/<roomId>` formatında kullanıma hazır.

Bu ayarlarla hem Supabase Auth hem de Valoria Hotel deep link’leri doğru şekilde yapılandırılmış olur.
