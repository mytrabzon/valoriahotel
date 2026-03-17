/**
 * Mobil cihazdan bağlanmak için Metro'yu LAN IP ile başlatır.
 * WEB AÇILMAZ – sadece telefonda Valoria Hotel uygulaması kullanılır.
 * Kullanım: npm run start:dev:lan
 */
const os = require('os');
const { spawn } = require('child_process');

console.log('');
console.log('  >>>  Valoria Hotel – Dev server  <<<');
console.log('  Android: QR okut veya uygulama içinde URL yapıştır.');
console.log('  iOS: Uygulama içinde "URL gir" var, QR yok → aşağıdaki adresi yapıştır.');
console.log('');

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const lanIp = getLanIp();
if (!lanIp) {
  console.warn('LAN IP bulunamadı. Tunnel kullanın: npm run start:dev:tunnel');
}

const env = { ...process.env };
if (lanIp) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
  console.log('  Bundler:', lanIp, '| Adres: exp://' + lanIp + ':8081');
  console.log('  iOS: Bu adresi kopyala → Valoria Hotel → URL gir → yapıştır.');
  console.log('');
}

// exp+valoria-hotel scheme ile QR okutulunca doğrudan Valoria uygulaması açılır
const child = spawn(
  'npx',
  ['expo', 'start', '--dev-client', '--clear', '--scheme', 'exp+valoria-hotel'],
  { stdio: 'inherit', shell: true, env }
);
child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
child.on('close', (code) => process.exit(code ?? 0));
