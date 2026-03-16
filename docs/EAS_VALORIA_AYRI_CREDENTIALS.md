# Valoria Hotel – mykbs’ten Ayrı iOS Kimlik Bilgileri

Build’in mykbs’e gitmediğinden emin olmak veya Valoria’yı tamamen ayrı kimlik bilgileriyle kullanmak için aşağıdaki adımları uygulayabilirsiniz.

## 1. Mevcut durumu anlamak

- **EAS build** her zaman **bu projenin** `app.json` / `eas.json` bilgilerine göre çalışır: slug `valoria-hotel`, bundle ID `com.valoria.hotel`.
- Üretilen IPA’nın içindeki uygulama **Valoria Hotel**’dir; “Used by: @luvolive/mykbs” sadece **aynı Apple sertifikasının** mykbs’te de kullanıldığını gösterir, build’in mykbs’e gittiği anlamına gelmez.

## 2. Valoria için EAS’taki iOS kimlik bilgilerini temizlemek

Valoria’yı **sadece kendine ait** bir dağıtım sertifikasıyla imzalamak istiyorsanız:

1. **Valoria proje klasöründe** terminali açın:
   ```bash
   cd "c:\Users\ilkse\OneDrive\Masaüstü\valorıahotel"
   ```

2. EAS kimlik bilgileri yönetimini başlatın:
   ```bash
   npx eas credentials
   ```

3. Sırayla:
   - **Platform:** iOS
   - **Build profile:** development (veya kullandığınız profil)
   - **Remove credentials** / **Distribution Certificate** ile bu projeye ait dağıtım sertifikasını EAS’tan kaldırın (Apple tarafında silinmez, sadece EAS’ın kullanımı kalkar).

4. Sonraki iOS build’de:
   ```bash
   npx eas build --profile development --platform ios
   ```
   - “Reuse this distribution certificate?” sorusunda **No** deyin.
   - EAS, **sadece bu proje** için yeni bir dağıtım sertifikası oluşturur (Apple hesabınızda en fazla 2 sertifika olabilir; mykbs’te biri kullanılıyorsa Valoria için ikincisi oluşturulur).

Böylece Valoria, mykbs ile **sertifika paylaşmadan** kendi kimlik bilgileriyle build alır.

## 3. Build’in doğru uygulama için olduğunu doğrulamak

- EAS build sayfasında (expo.dev) ilgili build’e tıklayın.
- **Build details** içinde **Bundle identifier** / **Application identifier** alanına bakın: `com.valoria.hotel` olmalı.
- İndirdiğiniz IPA’yı yüklediğinizde cihazda açılan uygulama **Valoria** olmalı (mykbs değil).

## 4. Özet

| Konu | Açıklama |
|------|----------|
| Build hedefi | Her zaman bu repo’daki `app.json` (Valoria, `com.valoria.hotel`). |
| “mykbs” görünmesi | Aynı Apple sertifikasının mykbs’te de kullanıldığını gösterir; build’in mykbs’e gitmesi değil. |
| Tam ayrım | `eas credentials` ile bu projenin iOS sertifikasını kaldırıp bir sonraki build’de “Reuse?” → No ile yeni sertifika oluşturun. |

Bu sayede mykbs’e öğrenmeden hiçbir şey göndermemiş olursunuz; build’ler Valoria için kalır, isterseniz sertifikayı da tamamen ayırmış olursunuz.
