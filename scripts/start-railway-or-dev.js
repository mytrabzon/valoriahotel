/**
 * Railway deploy:
 * - Start OPS API (railway-service) so mobile can call JSON endpoints.
 *
 * Local dev:
 * - Start Expo dev-client Metro (existing flow).
 */
const { spawn } = require('child_process');

function isRailway() {
  return Boolean(process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_PRIVATE_DOMAIN);
}

function run(cmd, args, opts) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  child.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
  child.on('close', (code) => process.exit(code ?? 0));
}

if (isRailway()) {
  console.log('Starting Railway OPS API (railway-service)...');
  // Assumes build step already ran and produced railway-service/dist.
  run('node', ['dist/app/server.js'], { cwd: 'railway-service' });
} else {
  run('node', ['scripts/dev-host.js']);
}

