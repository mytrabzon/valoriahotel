# Tek tip QR → Sözleşme onayı kurulumu

Tüm sözleşme onayı (tek QR + oda QR’ları) **tek bir URL** ile çalışır. Aşağıdakileri sırayla yapın.

---

## 1. Web sayfası adresi (sabit)

Sözleşme onay sayfası adresiniz şu formatta olmalı:

```
https://VALORIA_WEB_SITESI/guest/sign-one
```

Örnek (Vercel):

```
https://valoriahotel-el4r.vercel.app/guest/sign-one
```

Özel domain kullanıyorsanız (örn. valoria.app):

```
https://valoria.app/guest/sign-one
```

Bu adres **sabit**. Sonuna `?t=TOKEN&l=tr` sizin eklemenize gerek yok; uygulama otomatik ekler.

---

## 2. Nereye ne eklenecek?

### A) Uygulama içi (Admin panel) – zorunlu

1. Uygulamada **Admin** girişi yapın.
2. **Sözleşmeler** → **Ayarlar** ekranına gidin.
3. **"Sözleşme onay sayfası base URL"** alanına **yalnızca** şunu yapıştırın (kendi sitenize göre değiştirin):

   ```
   https://valoriahotel-el4r.vercel.app/guest/sign-one
   ```

4. **Kaydet**’e basın.

Bu değer Supabase’teki `app_settings` tablosuna `contract_qr_base_url` anahtarı ile yazılır. **Hem tek QR hem oda QR’ları** bu adresi kullanır.

### B) Vercel (isteğe bağlı)

Sadece **build sırasında** varsayılan kullanılsın isterseniz Vercel’de şu env’i ekleyebilirsiniz:

- **Key:** `EXPO_PUBLIC_PUBLIC_CONTRACT_URL`
- **Value:** `https://valoriahotel-el4r.vercel.app/guest/sign-one`

Bu, `app_settings` içinde `contract_qr_base_url` **boş** olduğunda devreye girer. Asıl kullanılan her zaman Admin’de kaydettiğiniz değerdir; Vercel env’i sadece yedek.

### C) Supabase – ekstra env gerekmez

Sözleşme onayı sayfası adresi **Supabase Environment Variables**’a eklenmez. Değer sadece:

- Admin panelden kaydedilip `app_settings` tablosunda tutulur,
- İsteğe bağlı olarak Vercel’de `EXPO_PUBLIC_PUBLIC_CONTRACT_URL` ile build’e gömülür.

Supabase’e sadece mevcut proje ayarlarınız (Supabase URL, anon key vb.) eklenmeye devam eder.

### D) .env (yerel geliştirme)

Yerel çalıştırırken aynı adresi kullanmak için `.env` içine:

```
EXPO_PUBLIC_PUBLIC_CONTRACT_URL=https://valoriahotel-el4r.vercel.app/guest/sign-one
```

ekleyebilirsiniz. Yine asıl kullanılan, Admin’de kaydettiğiniz `contract_qr_base_url`’dir.

---

## 3. Akış özeti

| Ne yapılıyor? | Nerede ayarlanır? | Değer |
|---------------|-------------------|--------|
| Tek QR / oda QR’larının açacağı sayfa | Admin → Sözleşmeler → Ayarlar → “Sözleşme onay sayfası base URL” | `https://.../guest/sign-one` |
| Build’te varsayılan (yedek) | Vercel → Project → Environment Variables | `EXPO_PUBLIC_PUBLIC_CONTRACT_URL` = aynı URL |
| Yerel dev (yedek) | Proje kökündeki `.env` | `EXPO_PUBLIC_PUBLIC_CONTRACT_URL` = aynı URL |

---

## 4. Kontrol

- **Tek QR:** Admin → Sözleşmeler → Ayarlar → “Yeni token oluştur (tek QR URL)” → Çıkan link `https://.../guest/sign-one?t=...&l=tr` ile başlamalı.
- **Oda QR:** Admin → Odalar → Bir oda → Sözleşme QR’ı yine `https://.../guest/sign-one?t=...&l=tr` formatında olmalı.
- Misafir bu linki açınca sözleşme formu gelir; onaylar **Admin → Sözleşme onayları** ve **Personel → Sözleşme onayları** ekranlarına düşer.

---

**Özet:** Sadece Admin panelde “Sözleşme onay sayfası base URL” alanına `https://valoriahotel-el4r.vercel.app/guest/sign-one` (veya kendi domain’iniz) yazıp kaydetmeniz yeterli. Başka yere URL koymanız zorunlu değil; Vercel/.env isteğe bağlı yedektir.
