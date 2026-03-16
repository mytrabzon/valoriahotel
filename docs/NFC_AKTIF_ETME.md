# NFC Özelliği (Aktif)

**NFC projede aktif.** Dijital Anahtar ekranında “NFC ile kapıyı aç” butonu ile kapı okuyucusundaki NFC etiket okunur.

**Önemli:** NFC native modül kullandığı için **Expo Go’da çalışmaz**. Gerçek cihazda test için **development build** alın: `npx expo prebuild` sonra `npx expo run:ios` / `npx expo run:android`, veya EAS Build.

---

## 1. Paket (kuruldu)

Expo’da yerleşik NFC yok; **react-native-nfc-manager** kullanılır:

```bash
npx expo install react-native-nfc-manager
```

- **Expo Go’da çalışmaz** – NFC native modül olduğu için **development build** (veya EAS Build) gerekir.
- Proje Expo 54 kullandığı için [react-native-nfc-manager](https://github.com/revtel/react-native-nfc-manager) sürümünün Expo 51/52+ ile uyumlu sürümünü kullanın; gerekirse config plugin ekleyin.

---

## 2. iOS ayarları

- **app.json** içinde `ios.infoPlist`:
  - `NFCReaderUsageDescription` – Kullanıcıya neden NFC kullandığınızı açıklayan metin.
- **Apple Developer** hesabında:
  - App ID → Capabilities: **NFC Tag Reading** (ve istenirse **NFC Background Tag Reading**) açın.
  - Profil/entitlements’ta NFC capability ekleyin.

---

## 3. Android ayarları

- **app.json** içinde `android.permissions` listesine:
  - `android.permission.NFC`
- AndroidManifest’te `<uses-feature android:name="android.hardware.nfc" />` genelde kütüphane tarafından eklenir.

---

## 4. Uygulama tarafı (kısa özet)

- Kapıya yaklaşınca **telefonun NFC’si “kart” gibi** davranacak şekilde (HCE – Host Card Emulation) kullanım, donanım ve işletim sistemi kısıtları nedeniyle karmaşıktır; birçok cihaz sadece **etiket okuma/yazma** destekler.
- Pratik alternatifler:
  - **NFC etiket okuma:** Kapıdaki NFC etiket okunur, uygulama açılır veya token backend’e gider, kapı açılır (mevcut deep link mantığına benzer).
  - **QR kod:** Dijital Anahtar ekranında gösterilen QR’ı kapı okuyucusu okur (donanım QR destekliyorsa).
  - **Bluetooth:** Kapıya yaklaşınca BLE ile cihaz tanınıp açma komutu (donanım ve yazılım entegrasyonu gerekir).

---

## Özet

| Soru | Cevap |
|------|--------|
| NFC şu an aktif mi? | **Hayır.** Hiçbir NFC kütüphanesi veya izin kullanılmıyor. |
| Nasıl aktif edilir? | `react-native-nfc-manager` kurulur, iOS/Android izin ve capability eklenir, development build alınır. |
| Dijital anahtar için tek yol NFC mi? | Hayır; QR veya Bluetooth da kullanılabilir, donanıma bağlı. |

İsterseniz bir sonraki adımda `react-native-nfc-manager` kurulumu ve `app.json` için net satırları yazabilirim.
