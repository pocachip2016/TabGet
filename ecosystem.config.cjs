module.exports = {
  apps: [
    {
      name: 'tabget-backend',
      cwd: '/home/ktalpha/Work/TabGet/backend',
      script: 'npx',
      args: 'tsx src/index.ts',
      interpreter: 'none',
      watch: ['src', 'prisma'],
      ignore_watch: ['node_modules', 'dist', '*.log'],
      watch_delay: 1000,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
        // BATTLE_ENABLED은 backend/.env 에서 관리 (기본 false, true로 설정 시 1시간 cron 활성화)
        // LLM_PROVIDER=gemini + GEMINI_API_KEY 필요 (~72 RPD/day, 무료 한도의 7%)
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
