# KBS gateway (Node / Fastify)

Üretimde **Hetzner VPS** üzerinde çalışan kanonik **KBS çıkış katmanı** (repo klasör adı tarihsel olarak `railway-service`).

- **Dinleme:** `PORT` (ör. **4000**), `0.0.0.0`
- **Sağlık:** `GET /health` → `service: valoria-kbs-gateway`
- **Edge köprüsü:** Mobil `supabase.functions.invoke('ops-proxy')` → Supabase secret `KBS_GATEWAY_URL` (örn. `http://178.104.12.20:4000`) + `KBS_GATEWAY_TOKEN` (`x-kbs-gateway-token`)
- **İç KBS HTTP:** `GATEWAY_BASE_URL` + `GATEWAY_SHARED_SECRET` (SOAP/XML veya mevcut iç gateway)
- **Gerçek KBS kimlikleri:** yalnızca bu sunucu ortamında (`KBS_CREDENTIAL_SECRET` vb.); mobil ve Supabase uygulama kodunda yok.

## Uçlar

- `POST /submissions/check-in` veya **`POST /kbs/check-in`**
- `POST /submissions/check-out` veya **`POST /kbs/check-out`**
- Diğer OPS yolları (odalar, izinler, …) mevcut modüllerde.

Yerelde: `npm run dev` (klasör içinde) veya monorepo kökünden `npm run start:ops-api` (build sonrası). Gateway’i tek başına denemek: kökte `START_KBS_GATEWAY=1 npm start`.

PM2/systemd: `../deploy/GATEWAY_PM2.md`
