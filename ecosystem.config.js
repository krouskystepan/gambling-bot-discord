module.exports = {
  apps: [
    {
      name: 'gambling-bot',
      script: 'src/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      cwd: '/var/www/apps/gambling-bot-discord',

      exec_mode: 'fork',
      instances: 1,

      autorestart: true,
      watch: false,
      max_memory_restart: '300M',

      env: {
        NODE_ENV: 'production'
      },
      env_file: '/var/www/envs/gambling-bot.env'
    }
  ]
}
