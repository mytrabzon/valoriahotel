# Valoria Hotel uygulaması – Nedir, nasıl açılır, nasıl çalışır?

## Uygulama tam olarak nedir?

Valoria Hotel **mobil uygulaması** şunlardan oluşur:

1. **Native kabuk (Android/iOS)**  
   Telefona yüklediğin APK veya IPA dosyası. Bu kabuk:
   - Kamera, konum, bildirimler, NFC gibi cihaz özelliklerine erişir.
   - Ekranda bir “pencere” açar; içinde **JavaScript kodu** çalıştırır.
   - **Tarayıcı değildir** – Safari/Chrome gibi web sayfası açmaz. Kendi ekranını çizer.

2. **JavaScript kodu (React Native)**  
   Bu kod:
   - **Geliştirme (dev) modunda:** Bilgisayardaki **Metro** sunucusundan canlı yüklenir (WiFi üzerinden).
   - **Production (yayın) build’inde:** APK/IPA’nın içine gömülüdür; internet olmadan da çalışır.

Yani uygulama = **native kabuk + JS kodu**. Web view gibi “bir web sayfası açan” bir şey değil; **React Native** ile yazılmış, tam ekran bir mobil uygulama.

---

## İndirilen uygulama QR okutmadan açılıyor – bu tam olarak ne?

İki farklı açılış türü var:

| Ne yaptın? | Uygulama nasıl açılıyor? | Neden? |
|------------|---------------------------|--------|
| **EAS'ten APK/IPA indirdin** (development / preview / production) | **QR'a gerek yok** – uygulamaya tıklayınca doğrudan karşılama ekranı gelir | Build alınırken **JavaScript kodu uygulamanın içine gömülü**. Kod bilgisayardan değil, **telefondaki dosyanın içinden** çalışır. Metro'ya bağlanmaya gerek yok. |
| **Geliştirme (canlı kod)** için kullanıyorsun | Uygulama açılınca **"Bağlan" / "URL gir"** ekranı çıkar; **QR okutman veya URL yapıştırman** gerekir | Bu modda kod **bilgisayardaki Metro'dan** gelir. Değişiklik yaptıkça telefonda anında güncellenir; bu yüzden bağlantı şart. |

**Özet:**  
- **"Uygulama indirildi, QR okutmadan açılıyor"** = EAS ile aldığın **build'in içinde kod var** (tek başına çalışan uygulama). Normal ve doğru davranış.  
- **"QR okutunca / URL girince açılıyor"** = **Geliştirme modu**; kod bilgisayardan (Metro) yükleniyor.

---

## Nasıl açılır?

### 1) Tek başına build (indirilen uygulama – QR yok)

- EAS'ten **development**, **preview** veya **production** ile build alıp APK/IPA'yı indirdin.
- Uygulamayı yükle → ikona tıkla → **doğrudan karşılama ekranı** (VALORIA HOTEL, 4 seçenek) gelir.
- **QR veya bilgisayar gerekmez.** Kod build sırasında uygulamanın içine gömüldüğü için her şey cihazda çalışır.

### 2) Geliştirme (development) – Metro'ya bağlanarak

- **Bilgisayarda:** `npm start` veya `npm run start:dev:lan` çalışır → **Metro** başlar (JS’i paketleyip sunar).
- **Telefonda:** **Valoria Hotel** (veya valoriahotel1) uygulamasına tıklarsın.
- Uygulama açılınca:
  - Önce “Bağlan” / “Enter URL” ekranı gelir (dev build).
  - Terminaldeki **QR’ı okutursun** veya `exp://192.168.x.x:8081` adresini yapıştırırsın.
- Bağlantı kurulunca uygulama **bilgisayardaki Metro’dan** JS’i alır ve ekranda gösterir.  
  Yani: **Uygulama açılır → Metro’ya bağlanır → Kod oradan gelir.** Tarayıcı yok, web view yok; sadece uygulama penceresi.

**Özet:** Uygulama = telefondaki ikon. Açınca ya Metro’ya bağlanırsın (QR/adres) ya da production build’de doğrudan ana ekran gelir.

### 2) Production (yayın) build

- APK/IPA’yı EAS ile “production” profilde alırsın.
- Kullanıcı uygulamayı yükleyip açar; **Metro yok**, kod zaten uygulamanın içinde.  
  İnternet sadece Supabase, harita vb. için kullanılır; uygulama kendisi “web’den açılan sayfa” değildir.

---

## Nasıl çalışır? (Web view ile farkı)

| | Web / Web view | Valoria Hotel (React Native) |
|--|----------------|------------------------------|
| **Ne çalıştırır?** | Tarayıcıda bir HTML/JS sayfası | Native uygulama içinde JS (React Native engine) |
| **Arayüz** | Tarayıcı çubuğu, sekme vb. olabilir | Tam ekran uygulama, kendi ekranları |
| **Cihaz erişimi** | Sınırlı (tarayıcı izinleri) | Kamera, NFC, konum, bildirim vb. tam erişim |
| **Geliştirme** | Sayfayı yenilersin | Metro’dan canlı yükleme veya build içinde gömülü kod |

Yani:
- **Web view:** Uygulama içinde bir tarayıcı penceresi açar, içinde web sayfası açılır.
- **Valoria Hotel:** Tarayıcı yok; doğrudan **native ekranlar** + **React Native** ile çizilen arayüz. Geliştirmede kod **Metro’dan** gelir, production’da **paketin içinden** çalışır.

---

## Akış özeti

1. **Telefonda “Valoria Hotel”e tıkla** → Native uygulama açılır.
2. **Dev build’de:** Bağlan ekranı gelir → QR okut veya URL yapıştır → Metro’dan JS yüklenir → Ana ekran (lobi vb.) görünür.
3. **Production build’de:** Doğrudan ana ekran gelir (kod uygulama içinde).
4. Supabase, harita, bildirimler hep bu **aynı uygulama** içinden; ekstra bir “web view” sayfası değil.

İstersen bir sonraki adımda “Metro nedir, QR tam olarak ne yapıyor?” gibi tek tek adımları da aynı dosyaya ekleyebilirim.
