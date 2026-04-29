/** PM2 örnek — yolu sunucudaki clone’a göre düzenle. Ayrıntı: deploy/GATEWAY_PM2.md */
module.exports = {
  apps: [
    {
      name: 'valoria-kbs-gateway',
      cwd: __dirname,
      script: 'dist/app/server.js',
      interpreter: 'node',
      env: { NODE_ENV: 'production', PORT: 4000 },
    },
  ],
};
