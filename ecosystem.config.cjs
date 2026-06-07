// PM2 process manifest for TVCC production VPS deployment.
// Usage:
//   bun install
//   bun run build
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup systemd
module.exports = {
  apps: [
    {
      name: "tvcc",
      script: ".output/server/index.mjs",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
