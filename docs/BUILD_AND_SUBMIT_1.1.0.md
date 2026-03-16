# Sürüm 1.1.0 – iOS ve Android Development Build / Gönderim

## Yapılan ayarlar

- **Sürüm:** `1.1.0` (app.json + package.json)
- **iOS:** `buildNumber: "2"`
- **Android:** `versionCode: 2`
- **eas.json:** `development` profili (internal distribution, iOS + Android)

## İlk kez EAS kullanıyorsanız

1. **Expo hesabı:** https://expo.dev adresinden ücretsiz hesap açın.
2. **EAS CLI giriş:**
   ```bash
   npx eas-cli login
   ```
3. **Projeyi EAS’e bağlama (bir kez):**
   ```bash
   npx eas init
   ```
   Proje Expo hesabınıza bağlanır.

## iOS ve Android development build (1.1.0)

Tek komutla her iki platform:

```bash
npx eas build --profile development --platform all
```

Sadece iOS:

```bash
npm run build:dev:ios
```

Sadece Android:

```bash
npm run build:dev:android
```

Build tamamlandıktan sonra EAS sayfasından .ipa (iOS) ve .apk (Android) indirebilirsiniz.

## TestFlight (iOS) ve Play Internal (Android) gönderimi

Build bittikten sonra:

- **iOS – TestFlight:**  
  ```bash
  npx eas submit --profile development --platform ios --latest
  ```  
  (Apple ID, App Store Connect app seçimi istenebilir.)

- **Android – Internal testing:**  
  ```bash
  npx eas submit --profile development --platform android --latest
  ```  
  (Google Play Console’da uygulama ve service account ayarlı olmalı.)

İlk submit’te EAS, gerekirse `eas.json` içine `submit.development` ile Apple/Google bilgilerini eklemenizi isteyebilir.

## Özet

| Ne yapıldı? | Durum |
|-------------|--------|
| Sürüm 1.1.0 | ✅ app.json, package.json |
| iOS buildNumber 2 | ✅ |
| Android versionCode 2 | ✅ |
| eas.json development profili | ✅ |
| npm script’ler (build:dev:ios, build:dev:android, submit:dev:*) | ✅ |
| EAS build/submit çalıştırma | Siz: `eas init` + `eas build` (ve isterseniz `eas submit`) |

Build’i başlatmak için proje klasöründe:

```bash
npx eas init
npx eas build --profile development --platform all
```
