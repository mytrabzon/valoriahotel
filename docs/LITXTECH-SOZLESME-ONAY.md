# Sözleşme Onayı – En Kolay Yollar

## Temiz URL (valoria.app gibi)

Sözleşme sayfası **valoria.app** (veya sizin alan adınız) üzerinde, kısa ve okunaklı bir adreste açılsın isterseniz:

**Örnek adres:** `https://valoria.app/sozlesme?t=XXX&l=tr`  
(Parametreler: `t` = token, `l` = dil; eski `token` ve `lang` de çalışır.)

### Ne yapmalısınız?

1. **`docs/valoria-app-sozlesme-page.html`** dosyasını valoria.app sunucunuza koyun; sayfa **/sozlesme** path’inde açılsın (veya /onay, /contract – tek segment yeterli).
2. Dosyada **`PROJE_ID`** yerine kendi Supabase proje adresinizi yazın (örn. `xyz.supabase.co`).
3. **.env** içine ekleyin:
   ```bash
   EXPO_PUBLIC_PUBLIC_CONTRACT_URL=https://valoria.app/sozlesme
   ```

Bundan sonra QR’lar ve linkler `https://valoria.app/sozlesme?t=...&l=tr` şeklinde temiz görünür; içerik Supabase’ten iframe ile yüklenir, adres çubuğu valoria.app’te kalır.

---

## Seçenek 1: Hiç özel domain kullanma (en kolay)

QR kodlar **doğrudan Supabase’teki hazır sayfaya** gitsin. Litxtech’e hiçbir şey eklemezsiniz.

- **Yapmanız gereken:** `.env` içinde sözleşme URL’sini **Supabase function** yapın (veya boş bırakın, zaten varsayılan bu):

```bash
# Bu satırı eklemeyin veya böyle bırakın – QR Supabase sayfasına gider
# EXPO_PUBLIC_PUBLIC_CONTRACT_URL=https://PROJE_ID.supabase.co/functions/v1/public-contract
```

- **Sonuç:** Misafir QR’ı okutunca Supabase’in hazır sözleşme sayfası açılır, “Okudum, Kabul Ediyorum” ile onay alınır. Bitti.

---

## Seçenek 2: Litxtech’te sadece iframe (tek sayfa)

“Sayfa litxtech’te açılsın” istiyorsanız: **sadece bir iframe** ekleyin. API, key, ek backend yok.

**Litxtech sayfanıza (örn. valoria-app) şunu koyun:**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Valoria – Sözleşme Onayı</title>
  <style>
    body { margin: 0; height: 100vh; }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
  </style>
</head>
<body>
  <iframe id="contract"></iframe>
  <script>
    var qs = new URLSearchParams(location.search);
    var token = qs.get('token') || qs.get('t') || '';
    var lang = qs.get('lang') || qs.get('l') || 'tr';
    var base = 'https://PROJE_ID.supabase.co/functions/v1/public-contract';
    document.getElementById('contract').src = base + '?t=' + encodeURIComponent(token) + '&l=' + encodeURIComponent(lang);
  </script>
</body>
</html>
```

**Sadece `PROJE_ID` kısmını** kendi Supabase proje URL’nizle değiştirin (örn. `abcdefgh.supabase.co`).

- **QR adresi:** `https://www.litxtech.com/valoria-app?t=XXX&l=tr`  
- **.env:** `EXPO_PUBLIC_PUBLIC_CONTRACT_URL=https://www.litxtech.com/valoria-app`

Bu kadar. Sayfa litxtech’te açılır, içerik ve onay Supabase’de çalışır.

---

## Özet

| Yöntem              | Ne yaparsınız | Görünen URL örneği |
|---------------------|---------------|---------------------|
| **Temiz URL**       | valoria.app/sozlesme sayfası + .env | `valoria.app/sozlesme?t=xxx&l=tr` |
| **1 – En kolay**    | Hiçbir şey (varsayılan) | `xxx.supabase.co/functions/v1/public-contract?t=...&l=tr` |
| **2 – Iframe**      | Litxtech’e tek HTML sayfa | litxtech (iframe içinde Supabase) |

Tüm seçeneklerde parametreler kısa: **t** = token, **l** = dil (eski `token` / `lang` de geçerli). Onay hep Supabase’e yazılır.
