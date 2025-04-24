module.exports = {
  apps: [{
    name: 'mcp-host',
    script: './dist/backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    error_file: './logs/mcp-host-error.log',
    out_file: './logs/mcp-host-out.log',
    log_file: './logs/mcp-host-combined.log'
  }]
}; 