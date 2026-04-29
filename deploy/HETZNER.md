# Hetzner VPS — KBS gateway (kanonik mimari)

> Aynı mimarinin **Railway** (iki servis, private network, statik giden IP) anlatımı: `deploy/RAILWAY.md`.

## Akış (zorunlu)

```
Mobil / web personel → Supabase (Auth, DB, Edge) → Edge ops-proxy → Hetzner gateway :4000 → iç kbs-gateway süreci → KBS
```

- **Supabase asla Jandarma/KBS endpoint’ine doğrudan gitmez.**
- **Mobil uygulama asla KBS’ye doğrudan gitmez** (`lib/kbsApi` yalnızca `ops-proxy` invoke eder).
- **KBS’ye giden trafik yalnızca Hetzner sabit IP üzerinden** (gateway + iç süreçler).

## 1) Supabase Edge secrets

Dashboard → **Edge Functions** → **Secrets** (veya CLI):

```bash
supabase secrets set KBS_GATEWAY_URL=http://178.104.12.20:4000
supabase secrets set KBS_GATEWAY_TOKEN=<uzun-rastgele-güvenli-değer>
supabase functions deploy ops-proxy
```

- `KBS_GATEWAY_URL`: Sonunda **`/` yok**, **http:// ile başlayan adresin içinde boşluk yok** (yaygın hata: `http:// 178...`).
- `KBS_GATEWAY_TOKEN`: VPS’teki gateway ortam değişkeni **`KBS_GATEWAY_TOKEN`** ile **aynı** olmalı; Edge istekte `x-kbs-gateway-token` başlığıyla gönderir.

Geriye dönük: yalnızca eski projeler için `OPS_VPS_URL` hâlâ okunur (`KBS_GATEWAY_URL` yoksa).

## 2) Hetzner gateway (repo: `railway-service/`)

Üretim tabanı: **`http://178.104.12.20:4000`**  
Sağlık: **`GET /health`** → `{ ok: true, service: "valoria-kbs-gateway", ... }`

### Ortam (VPS)

| Değişken | Açıklama |
|----------|----------|
| `PORT` | `4000` |
| `SUPABASE_URL` | Supabase proje URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Sunucu tarafı (repo’da istemciye verilmez) |
| `GATEWAY_BASE_URL` | Aynı VPS’te iç KBS HTTP gateway (örn. `http://127.0.0.1:4001`) |
| `GATEWAY_SHARED_SECRET` | OPS ↔ iç gateway paylaşımlı sır |
| `KBS_CREDENTIAL_SECRET` | KBS kimlik şifrelemesi (yalnız VPS) |
| `KBS_GATEWAY_TOKEN` | Edge’den gelen `x-kbs-gateway-token` ile eşleşmeli; üretimde **zorunlu** önerilir |

### HTTP API (personel JWT + gateway token)

- Personel **Supabase JWT** (`Authorization: Bearer …`) — `ops.app_users` ile otel kapsamı.
- Edge’den gelen isteklerde ek: **`x-kbs-gateway-token`** = `KBS_GATEWAY_TOKEN`.

### KBS ile uyumlu yollar (alias)

- Check-in: `POST /submissions/check-in` veya **`POST /kbs/check-in`**
- Check-out: `POST /submissions/check-out` veya **`POST /kbs/check-out`**

Gerçek Jandarma çağrısı **yalnızca** VPS içindeki `kbs-gateway-service` (veya eşdeğeri) üzerinden; kimlik bilgileri mobilde ve Supabase uygulama kodunda tutulmaz.

## 3) Veritabanı

Önemli migration örnekleri:

- `137_ops_official_checkin_system.sql` — ops şeması
- `143_kbs_logs_and_staff_access.sql` — `kbs_logs`, `kbs_access_enabled`
- `150_official_submission_kbs_tracking_columns.sql` — `kbs_status`, `kbs_sent_at`, vb.

## 4) Edge’de “tam orchestration” (gelecek faz)

Şu an iş mantığı ve KBS yanıt yazımı **gateway (Node) + DB** üzerinde; Edge **`ops-proxy`** ile güvenli iletim katmanıdır. İstenirse sonraki fazda: pending işaretleme ve logların bir kısmı Edge + service role ile genişletilebilir — mimari kısıt **KBS’ye yalnızca Hetzner** olmaya devam eder.

## 5) Süreç yönetimi

Bakım ve reboot sonrası otomatik kalkması için: **`deploy/GATEWAY_PM2.md`**.
