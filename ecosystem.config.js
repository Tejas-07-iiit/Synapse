module.exports = {
  apps: [
    {
      name: "synapse-next-app",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "synapse-trading-daemon",
      script: "npx tsx src/server/daemon.ts",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
