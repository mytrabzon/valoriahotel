# Railway — KBS gateway kurulumu (Hetzner alternatifi)

Bu repo için kanonik akış, `deploy/HETZNER.md` ile aynı mimaridir; yalnızca **KBS’ye giden trafiğin çıktığı** sunucu Hetzner VPS yerine **Railway** üzerinde çalışır.

```
Mobil → Supabase (Auth, DB) → Edge `ops-proxy` → [Railway: ops API] → [Railway: iç KBS HTTP gateway] → Jandarma KBS (SOAP)
```

- Mobil **asla** Jandarma URL’sine bağlanmaz (`lib/kbsApi` yalnızca Edge `ops-proxy` çağırır).
- Supabase Edge, **dış** Railway hizmetinin genel `https://…` adresine gider (`KBS_GATEWAY_URL`).
- İç gateway’e sadece dış hizmet (aynı Railway projesinde private network ile) gider; Jandarma çağrısı **iç** süreçten yapılır.

## 1) Railway’de iki ayrı servis

| Servis (örnek isim) | Klasör | Dışarıya açık? | Rol |
|---------------------|--------|----------------|-----|
| `valoria-ops` (veya `kbs-ops`) | `railway-service/` | **Evet** (public URL) | Fastify: JWT, `ops` API, admin KBS, iç gateway’e HMAC ile proxy |
| `valoria-kbs-core` (veya `kbs-gateway`) | `kbs-gateway-service/` | **Hayır** (sadece private) | Jandarma SOAP, `OFFICIAL_PROVIDER_MODE=http` |

Root directory (Railway proje ayarı): her serviste sırasıyla `railway-service` ve `kbs-gateway-service` olarak ayarlayın.

**Build** (her iki servis için genelde): `npm ci && npm run build`  
**Start:** `node dist/app/server.js`  
`package.json` içinde `start` zaten bunu çalıştırır; Start Command olarak `npm start` de verilebilir.

## 2) Supabase Edge secrets (zorunlu)

Supabase projenizde (CLI veya Dashboard → Edge Functions → Secrets):

```bash
supabase secrets set KBS_GATEWAY_URL=https://<valoria-ops-public-host>.up.railway.app
supabase secrets set KBS_GATEWAY_TOKEN=<uzun-rastgele-tek-gizli>
supabase functions deploy ops-proxy
```

- `KBS_GATEWAY_URL`: **Dış** `valoria-ops` hizmetinin `https://` adresi. Sonunda **`/` yok**, adres içinde **boşluk yok**.
- `KBS_GATEWAY_TOKEN`: Aşağıdaki **Ops API** hizmetindeki `KBS_GATEWAY_TOKEN` ile **birebir aynı** olmalı. Edge, isteğe `x-kbs-gateway-token` ekler; `ops-proxy` kaynağı: `supabase/functions/ops-proxy/index.ts`.

> Eski isim: `OPS_VPS_URL` hâlâ yedek okunur; yeni kurulumda yalnızca `KBS_GATEWAY_URL` kullanın.

## 3) Ortam değişkenleri — `valoria-ops` (`railway-service`)

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `PORT` | Otomatik | Railway tarafından verilir; dinleme `0.0.0.0` (kod zaten `host: '0.0.0.0'`). |
| `SUPABASE_URL` | Evet | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | Service role (yalnız sunucu; istemciye verilmez). |
| `GATEWAY_BASE_URL` | Evet | İç KBS servisine private URL, ör. `http://valoria-kbs-core.railway.internal:PORT` (aşağıya bakın). |
| `GATEWAY_SHARED_SECRET` | Evet | **En az 16 karakter**. İç KBS hizmetindeki `GATEWAY_SHARED_SECRET` ile **aynı** (HMAC imzası). |
| `KBS_CREDENTIAL_SECRET` | Evet | **En az 16 karakter**. İç gateway’deki `KBS_CREDENTIAL_SECRET` ile **aynı** — `ops.hotel_kbs_credentials` şifreleme. |
| `KBS_GATEWAY_TOKEN` | Üretimde evet | Supabase `KBS_GATEWAY_TOKEN` ve aynı değer; `x-kbs-gateway-token` doğrulaması (`authPlugin`). Boş bırakılırsa sadece geliştirme gibi (token zorunlu değil) — **üretimde doldurun.** |
| `APP_ENV` | İsteğe bağlı | `prod` / `staging` / `local` (varsayılan: `local`). |
| `LOG_LEVEL` | İsteğe bağlı | `info` veya `debug`. |

**Private `GATEWAY_BASE_URL`:** Hedef servis adınız `valoria-kbs-core` ise ve o servis Railway’in verdiği `PORT` (ör. `8080`) ile dinliyorsa:

`http://valoria-kbs-core.railway.internal:8080`  

(İsim, Railway’de o servise verdiğiniz **slug** / service name ile aynı olmalı. Güncel kalıbı: [Private networking](https://docs.railway.app/networking/private-networking).)  
Hedefin `PORT` değerini, **iç** servisin Variables sekmesinde görürsünüz.

**Sağlık:** Tarayıcı veya `curl` ile: `GET https://<ops-public>/health` → JSON içinde `valoria-kbs-gateway`.

## 4) Ortam değişkenleri — `valoria-kbs-core` (`kbs-gateway-service`)

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `PORT` | Genelde evet | Railway inject eder; dış hizmetin `GATEWAY_BASE_URL`’indeki port ile aynı olmalı. |
| `SUPABASE_URL` | Evet | Ops ile aynı proje. |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | Ops ile aynı. |
| `GATEWAY_SHARED_SECRET` | Evet | Ops API ile **aynı**. |
| `KBS_CREDENTIAL_SECRET` | Evet | Ops API ile **aynı**. |
| `OFFICIAL_PROVIDER_MODE` | Evet (canlı) | `http` (gerçek Jandarma). |
| `OFFICIAL_PROVIDER_BASE_URL` | `http` ise evet | Örn. `https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc` (`.env.example` ile uyumlu). |
| `LOG_LEVEL` | İsteğe bağlı | `info` |

**Sağlık (iç / ya da public geçici test):** `GET .../gateway/health` → `kbs-gateway-service` (bkz. `kbs-gateway-service` kaynak `app`).

**Public domain eklemeyin** (öneri): Bu servis yalnızca `valoria-ops` tarafından private URL ile çağrılsın; böylece yüzey alanı küçülür.

## 5) Sabit (statik) çıkış IP — Jandarma / KBS için

Kurum sizden **sabit giden (outbound) IP** istiyorsa:

1. Bu trafik **iç** servisten (Jandarma’ya giden) çıkar: **Static Outbound IP**’yi `valoria-kbs-core` (kbs-gateway-service) servisinde açın.  
2. [Railway dokümantasyonu: Static Outbound IPs](https://docs.railway.app/reference/static-outbound-ips) — **Pro** planda; panelde servis **Settings → Networking** üzerinden etkinleştirilir, bir sonraki deploy sonrası geçerli olur.  
3. Görünen IPv4’ü Jandarma / tesis KBS erişim beyanına ekleyin.

> Statik IP **gelen (inbound)** trafik içindir değil; sadece **dışarıya giden** çağrılar için whitelisting senaryolarda kullanılır.

Dış `valoria-ops` hizmetinin giden IP’si, Edge’den gelen **gelen** isteklerle ilgilidir; Jandarma’ya giden yol `valoria-kbs-core` üzerinden olduğundan, beyan edilecek IP bu iç servisinkidir.

## 6) Doğrulama listesi (kısa)

1. `valoria-kbs-core` deploy, private URL ile `curl` veya `valoria-ops` log’larından iç gateway cevabı.  
2. `valoria-ops` `GET /health` — public URL.  
3. `KBS_GATEWAY_URL` + `KBS_GATEWAY_TOKEN` Supabase’de; `ops-proxy` redeploy.  
4. Uygulamada (Admin) KBS ayarları: otel KBS bilgileri kaydı / test (kimlikler DB’de şifreli).  
5. `EXPO_PUBLIC_KBS_UI_ENABLED=true` (EAS / `.env`) ile personel KBS ekranları açık.  
6. Gerekirse: `get_my_kbs_access_enabled` RPC ve `ops.app_users` / KBS yetkileri migration’ları uygulu (`deploy/HETZNER.md` “Veritabanı” bölümü aynı).

## 7) Sık hatalar

| Belirti | Olası neden |
|---------|-------------|
| Edge `KBS_GATEWAY_URL is not set` | Supabase secret eksik / `ops-proxy` yeniden deploy edilmedi. |
| 403 `Invalid or missing gateway token` | `KBS_GATEWAY_TOKEN` (Supabase) ≠ `KBS_GATEWAY_TOKEN` (ops). |
| 502 / upstream HTML | `KBS_GATEWAY_URL` yanlış port veya `http`/`https` karışıklığı; ops servisi down. |
| `GATEWAY_UNREACHABLE` (ops log) | `GATEWAY_BASE_URL` / private DNS veya hedef `PORT` yanlış; iç servis ayakta değil. |
| KBS “bağlanamadı” (SOAP) | `OFFICIAL_PROVIDER_MODE`, `OFFICIAL_PROVIDER_BASE_URL`; iç serviste static IP ve kurum whitelistsi. |

## 8) Hetzner ile fark

- Hetzner’de: aynı makinede `127.0.0.1:4000` (ops) + `127.0.0.1:4001` (iç) yaygındı.  
- Railway’de: **private hostname** + hedef servisin `PORT` (ör. `valoria-kbs-core.railway.internal:PORT`).  
- Uygulama kodu ve Supabase `ops-proxy` aynı kalır; sadece `KBS_GATEWAY_URL` artık Railway public `https` kök URI’sidir.
