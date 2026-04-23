module.exports = {
  apps: [
    {
      name: 'tabget-backend',
      cwd: '/home/ktalpha/Work/TabGet/backend',
      script: 'npx',
      args: 'tsx src/index.ts',
      interpreter: 'none',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'tabget-frontend',
      cwd: '/home/ktalpha/Work/TabGet/tabget-app',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
}
