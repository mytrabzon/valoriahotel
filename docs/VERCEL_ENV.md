# Vercel'e eklenecek environment variables

**Sözleşme sayfası** (`/guest/sign-one`) çalışsın diye Vercel'de **mutlaka** şunları ekleyin.

## Nerede eklenir?

1. [vercel.com](https://vercel.com) → Projeniz
2. **Settings** → **Environment Variables**
3. Aşağıdaki her satır için **Key** ve **Value** girip **Save**. Value'ları kendi `.env` dosyanızdan kopyalayın.

---

## Zorunlu (olmadan sayfa hata verir)

| Key | Nereden alınır | Örnek (kendi değerinizi yazın) |
|-----|----------------|----------------------------------|
| `EXPO_PUBLIC_SUPABASE_URL` | .env | `https://xxxxx.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | .env | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` (uzun JWT) |

Bu ikisi **yoksa** Supabase bağlantısı kurulmaz, sayfa "Hata oluştu" der.

---

## İsteğe bağlı (sözleşme sayfası için gerekli değil)

- `EXPO_PUBLIC_PUBLIC_CONTRACT_URL` – Sözleşme base URL (örn. `https://valoriahotel-el4r.vercel.app/guest/sign-one`)
- `EXPO_PUBLIC_HOTEL_LAT` / `EXPO_PUBLIC_HOTEL_LON` – Harita/konum
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` – Harita

---

## Son adım

Env'leri ekledikten sonra **mutlaka yeniden deploy** alın:

- **Deployments** → son deployment → **⋯** → **Redeploy**

veya yeni bir commit atıp push edin. EXPO_PUBLIC_* değişkenleri **build sırasında** gömülür; sonradan eklediğiniz env'ler eski deploy'da yoktur.
