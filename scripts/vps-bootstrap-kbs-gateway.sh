#!/usr/bin/env bash
# Tek seferlik VPS kurulumu (Hetzner Cloud Console / tarayıcı terminalinde çalıştırın).
# PowerShell veya Windows gerekmez.
#
# Önce: Hetzner → Sunucu → Console (veya SSH ile Linux kabuğuna girin)
# Sonra: bu dosyanın içeriğini kopyalayıp yapıştırın VEYA repo kökünden:
#   bash scripts/vps-bootstrap-kbs-gateway.sh
#
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "==> git kuruluyor..."
  sudo apt-get update -y
  sudo apt-get install -y git
fi

INSTALL_DIR="${INSTALL_DIR:-/opt/valoria-kbs-gateway}"
REPO_URL="${REPO_URL:-https://github.com/mytrabzon/valoriahotel.git}"
BRANCH="${BRANCH:-main}"

echo "==> Dizin: $INSTALL_DIR"
sudo mkdir -p "$INSTALL_DIR"
sudo chown -R "$(whoami):$(id -gn)" "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [[ ! -d valoriahotel/.git ]]; then
  echo "==> Repo klonlanıyor..."
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" valoriahotel
else
  echo "==> Repo var, güncelleniyor..."
  (cd valoriahotel && git fetch origin "$BRANCH" && git reset --hard "origin/$BRANCH")
fi

cd valoriahotel/kbs-gateway-service

if [[ ! -f .env ]]; then
  echo "==> .env yok; .env.example kopyalanıyor. LÜTFEN düzenleyin: nano .env"
  cp .env.example .env
fi

echo "==> Bağımlılıklar ve build..."
command -v node >/dev/null 2>&1 || { echo "Node yok; kurulum için: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"; exit 1; }
npm ci
npm run build

echo "==> PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm i -g pm2
fi

pm2 delete kbs-gateway 2>/dev/null || true
pm2 start dist/app/server.js --name kbs-gateway
pm2 save
pm2 startup systemd -u "$(whoami)" --hp "$HOME" || true

echo ""
echo "==> Yerel test (VPS içinde):"
echo "    curl -sS http://127.0.0.1:4000/gateway/health"
echo ""
echo "==> Dışarıdan test (PC tarayıcı):"
echo "    http://$(curl -fsS ifconfig.me 2>/dev/null || echo 'SUNUCU_IP'):4000/gateway/health"
echo ""
echo "Sonra .env içinde OFFICIAL_PROVIDER_MODE=http ve OFFICIAL_PROVIDER_BASE_URL ayarlayın (Jandarma SOAP)."
