module.exports = {
  apps: [
    {
      name: 'clock-agent',
      script: 'agent/index.ts',
      interpreter: 'tsx',
      cwd: 'D:\\PontoWebDesk',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      // Reinicia automaticamente se der erro
      restart_delay: 5000,
      // Logs
      log_file: 'D:\\PontoWebDesk\\agent\\logs\\agent.log',
      out_file: 'D:\\PontoWebDesk\\agent\\logs\\agent-out.log',
      err_file: 'D:\\PontoWebDesk\\agent\\logs\\agent-error.log'
    }
  ]
};
