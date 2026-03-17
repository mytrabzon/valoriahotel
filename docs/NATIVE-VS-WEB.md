# Valoria Hotel – Native uygulama vs web görünümü

## Sorun ne?

React Native ile **native** uygulama yapıyorsun ama:

- Çıktı web sayfası gibi görünüyor
- Safari’de açılıyor
- Native hissiyat yok

**Sebep:** Yanlış başlatma veya yanlış build: web modunda çalıştırma veya QR’ı tarayıcıda açma.

---

## Native uygulama vs web görünümü

| **Native uygulama** | **Web görünümü (istenmeyen)** |
|--------------------|-------------------------------|
| Telefonda gerçek uygulama ikonu | Tarayıcı içinde açılan sayfa |
| Status bar, native butonlar | Safari/Chrome URL çubuğu |
| Hızlı, doğal his | Yavaş, web hissi |
| Offline çalışabilir (kod pakette) | İnternet şart |

---

## Doğru yapılandırma (Valoria Hotel)

### 1. Projeyi doğru başlat

```bash
# ❌ YANLIŞ – web açar, Safari’de açılır
npx expo start --web

# ❌ YANLIŞ – telefonda "Kod bulunamadı" (localhost)
npx expo start --clear

# ✅ DOĞRU – native, telefon Metro’ya bağlanır
npm start
# veya
npm run start:dev:lan
# veya
npx expo start --dev-client --scheme exp+valoria-hotel
```

`npm start` bu projede LAN IP + dev-client + scheme kullanır; QR okutunca **Valoria Hotel uygulamasında** açılır, Safari’de değil.

### 2. QR’ı nasıl okutacaksın

- **❌ YANLIŞ:** QR’ı **kamera uygulamasıyla** okutmak → link Safari’de açılır (web görünümü).
- **✅ DOĞRU:** QR’ı **Valoria Hotel (dev build) uygulamasıyla** okutmak veya uygulama içinde “URL gir” deyip `exp://192.168.x.x:8081` yapıştırmak.

Bu projede scheme `exp+valoria-hotel` olduğu için QR’ı **kamerayla** okutsan bile link Valoria Hotel’e gidebilir (yeni build’de). Eski build’de QR’ı mutlaka **uygulama içinden** okut veya URL’i elle gir.

### 3. Hangi build = gerçek native uygulama

| Build türü | Komut | Ne için? | Native mi? |
|------------|--------|----------|------------|
| **Development** | `npm run build:dev:android` / `build:dev:ios` | Geliştirme, Metro’ya bağlanma, QR | ✅ Evet (dev menü + launcher var) |
| **Preview** | `npm run build:preview:android` / `build:preview:ios` | Test / dahili dağıtım, Metro yok | ✅ Evet |
| **Production** | `npm run build:prod:android` / `build:prod:ios` | Mağaza / gerçek kullanıcı | ✅ Evet |

Hepsi **native** uygulama üretir. Fark: development’ta “Bağlan” ekranı ve Metro bağlantısı vardır; preview/production’da doğrudan uygulama açılır.

### 4. Build’i telefona yükle

- EAS’ten indirdiğin **.apk** (Android) veya **.ipa** (iOS) dosyasını telefona kur.
- Ana ekranda **Valoria Hotel** ikonu çıkar → tıkla, **native** uygulama açılır (Safari değil).

---

## Web gibi görünüyorsa olası sebepler

| Sebep | Çözüm |
|-------|--------|
| `npx expo start --web` kullanıyorsun | `npm start` veya `npx expo start --dev-client --scheme exp+valoria-hotel` kullan. Bu projede `npm run web` zaten yok. |
| QR’ı kamerayla okutuyorsun | QR’ı **Valoria Hotel** uygulaması içinden okut veya URL’i uygulama içine yapıştır. |
| Expo Go ile test ediyorsun | Gerçek **development** veya **preview** build al, APK/IPA’yı yükle, o uygulamayı aç. |
| Yanlış profile ile build aldın | Native için: `development`, `preview` veya `production` kullan. Web build değil. |

---

## Hemen yapman gerekenler

1. **Projeyi native için başlat:**  
   `npm start`  
   (Web için komut kullanma.)

2. **Telefonda:** Yüklü olan **Valoria Hotel** (dev build) uygulamasını aç. QR’ı bu uygulama içinden okut veya terminaldeki `exp://192.168.x.x:8081` adresini “URL gir” alanına yapıştır.

3. **Gerçek native build (launcher olmadan) istiyorsan:**  
   ```bash
   npm run build:preview:android
   ```  
   Çıkan APK’yı telefona kur; ikondan açınca doğrudan uygulama açılır, Metro gerekmez.

---

## Özet

- **React Native = native uygulama.** Bu proje web sayfası değil, gerçek telefon uygulaması.
- **Web gibi görünmesi:** Yanlış başlatma (--web) veya QR’ın tarayıcıda açılması.
- **Yapman gerekenler:**  
  - Geliştirme: `npm start` + QR’ı **uygulama içinden** okut veya URL yapıştır.  
  - Dağıtım: `build:preview` veya `build:prod` ile build al, APK/IPA’yı kur, ikondan aç.

**Expo Go sadece test içindir; gerçek native deneyim için EAS ile alınan build’i (development / preview / production) kullan.**
