module.exports = {
  apps: [
    {
      name: 'gambling-bot',
      script: 'pnpm',
      args: 'start',
      cwd: '/var/www/apps/gambling-bot-discord',

      exec_mode: 'fork',
      instances: 1,

      autorestart: true,
      watch: false,
      max_memory_restart: '300M',

      env: {
        NODE_ENV: 'production',
        DOTENV_CONFIG_PATH: '/var/www/envs/gambling-bot.env'
      }
    }
  ]
}
