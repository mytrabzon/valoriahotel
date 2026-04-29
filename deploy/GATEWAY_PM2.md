# KBS gateway’i kalıcı çalıştırma (Hetzner)

## Önce: doğru dizin ve doğru süreç

- **`cd railway-service: No such file`** → Henüz repoyu bu sunucuya klonlamadınız veya farklı bir klasördesiniz. Önce repoyu indirin (Git URL sizin), örnek:
  ```bash
  cd /opt   # veya /home/ubuntu
  git clone <REPO_URL> valoria-hotel
  cd valoria-hotel/railway-service
  ```
- **`fatal: not a git repository`** → `git pull` komutunu proje kökünde değil, örneğin `/root` içinde çalıştırmışsınız. `pwd` ile konumu kontrol edin; `valoria-hotel` (veya clone adınız) içine girin.
- **`npm ci` lockfile yok** → Bu repoda `railway-service/package-lock.json` vardır; yanlış dizindesinizdir **veya** kopya eksiktir. Doğru klasörde `ls package-lock.json`. Gerekirse: `npm install` (lockfile yoksa üretir; sonra tercihen `npm ci` kullanın).
- **`pm2: command not found`** → `sudo npm install -g pm2` (Node kurulu olmalı; yoksa önce `nodejs` / nvm kurun).
- **`curl .../health` sadece `OK` dönüyorsa** → Port **4000**’de **bu projenin Fastify gateway’i çalışmıyor** demektir. Bizim sağlık yanıtı **JSON** olmalı, örneğin `{"ok":true,"service":"valoria-kbs-gateway",...}`. Düz `OK` genelde başka bir stub, eski script veya yanlış süreçtir. Kontrol:
  ```bash
  sudo ss -tlnp | grep 4000
  # PID’ye bakın; node dist/app/server.js değilse yanlış süreç dinliyor olabilir
  ```

## PM2 (önerilen)

Repo kökünde örnek: `railway-service/ecosystem.config.cjs`

Sunucuda (yolları kendi clone’a göre düzenleyin):

```bash
cd /path/to/valoria-hotel/railway-service
# package-lock.json varsa:
npm ci
# yoksa veya hata verirse:
# npm install
npm run build
```

Ortamı `/etc/environment`, `pm2 ecosystem` içi `env` veya `.env` ile verin; ardından:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# çıkan komutu root ile bir kez çalıştırın — reboot sonrası PM2 ve uygulama ayağa kalkar
```

### Kontrol

```bash
pm2 status
curl -sS http://127.0.0.1:4000/health
# Beklenen: JSON içinde "valoria-kbs-gateway" veya en azından {"ok":true,...}
curl -sS http://178.104.12.20:4000/health
```

**Port çakışması:** Eski stub hâlâ 4000’i tutuyorsa önce durdurun (`pm2 delete ...` veya ilgili systemd stop), sonra bu gateway’i aynı portta başlatın.

## systemd (alternatif)

`/etc/systemd/system/valoria-kbs-gateway.service` örneği:

```ini
[Unit]
Description=Valoria KBS gateway (Node)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/valoria/railway-service
Environment=NODE_ENV=production
Environment=PORT=4000
EnvironmentFile=/path/to/valoria/railway-service/.env
ExecStart=/usr/bin/node dist/app/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now valoria-kbs-gateway
```

## Güvenlik duvarı

Gelen: **TCP 22** (SSH), **TCP 4000** (Edge → gateway).  
KBS çıkış trafiği: gateway ve iç süreçlerden **outbound** (varsayılan outbound açık).
