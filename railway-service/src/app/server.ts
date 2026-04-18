import { buildApp } from './app.js';

const app = buildApp();

async function main() {
  const port = app.env.PORT;
  const host = '0.0.0.0';
  await app.listen({ port, host });
  // eslint-disable-next-line no-console
  console.log(`[railway-service] listening on ${host}:${port} (pid ${process.pid})`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

