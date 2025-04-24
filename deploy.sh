#!/bin/bash
# Comprehensive deployment script for MCP Host

set -e

# Configuration
APP_DIR="/home/ubuntu/apps/mcp-host-node-simple"
DEPLOY_LOG="/home/ubuntu/deploy-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="/home/ubuntu/backups/mcp-host"
NGINX_CONF="/etc/nginx/sites-available/mcp-host"
MAX_BACKUPS=5

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Log function
log() {
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $1" | tee -a "$DEPLOY_LOG"
}

# Create backup
create_backup() {
  log "Creating backup..."
  BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$BACKUP_FILE" -C "$(dirname "$APP_DIR")" "$(basename "$APP_DIR")" --exclude="node_modules" --exclude="src/frontend/node_modules"
  log "Backup created at $BACKUP_FILE"
  
  # Clean old backups
  ls -t "$BACKUP_DIR"/backup-*.tar.gz | tail -n +$((MAX_BACKUPS+1)) | xargs rm -f 2>/dev/null || true
  log "Cleaned old backups, keeping latest $MAX_BACKUPS"
}

# Restore from backup in case of failure
restore_from_backup() {
  log "Deployment failed. Restoring from backup..."
  LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/backup-*.tar.gz | head -1)
  
  if [ -n "$LATEST_BACKUP" ]; then
    log "Restoring from $LATEST_BACKUP"
    rm -rf "$APP_DIR"
    mkdir -p "$APP_DIR"
    tar -xzf "$LATEST_BACKUP" -C "$(dirname "$APP_DIR")"
    log "Restore complete"
  else
    log "No backup found to restore from!"
  fi
}

# Check system resources
check_resources() {
  log "Checking system resources..."
  
  # Check disk space (need at least 1GB free)
  FREE_SPACE=$(df -m / | awk 'NR==2 {print $4}')
  if [ "$FREE_SPACE" -lt 1024 ]; then
    log "ERROR: Not enough disk space. Only ${FREE_SPACE}MB available."
    exit 1
  fi
  
  # Check memory
  FREE_MEM=$(free -m | awk 'NR==2 {print $7}')
  if [ "$FREE_MEM" -lt 512 ]; then
    log "WARNING: Low memory available (${FREE_MEM}MB). Deployment might be slow."
  fi
  
  log "System resources check passed"
}

# Start deployment
log "===== STARTING DEPLOYMENT ====="
log "Target directory: $APP_DIR"

# Check resources
check_resources

# Create backup
create_backup

# Navigate to app directory
cd "$APP_DIR"
log "Current directory: $(pwd)"

# Pull latest changes
log "Pulling latest code..."
git fetch --all
git reset --hard origin/main

# Install dependencies
log "Installing dependencies..."
export PATH="$HOME/.nvm/versions/node/v18.17.1/bin:$PATH"
pnpm install
pnpm run install:frontend

# Build application
log "Building application..."
pnpm run build:all

# Ensure production environment is set in .env
log "Checking environment configuration..."
if grep -q "NODE_ENV=production" .env; then
  log "Production environment already configured"
else
  log "Setting NODE_ENV to production in .env file"
  sed -i 's/NODE_ENV=.*/NODE_ENV=production/' .env
  if ! grep -q "NODE_ENV=" .env; then
    echo "NODE_ENV=production" >> .env
    log "Added NODE_ENV=production to .env file"
  fi
fi

# Check nginx config
if [ -f "$NGINX_CONF" ]; then
  log "Testing Nginx configuration..."
  sudo nginx -t
  if [ $? -ne 0 ]; then
    log "ERROR: Nginx configuration test failed!"
    restore_from_backup
    exit 1
  fi
fi

# Start/restart services with PM2
log "Starting services with PM2..."
if pm2 list | grep -q "mcp-host"; then
  log "Restarting existing PM2 service..."
  pm2 restart mcp-host
else
  log "Starting new PM2 service using ecosystem.config.js..."
  pm2 start ecosystem.config.js --env production
fi

# Save PM2 configuration
log "Saving PM2 configuration..."
pm2 save

# Reload nginx if it exists
if [ -f "$NGINX_CONF" ]; then
  log "Reloading Nginx..."
  sudo systemctl reload nginx
fi

# Verify deployment
log "Verifying deployment..."
sleep 10
HEALTH_CHECK=$(curl -s http://localhost:3001/health)
if echo "$HEALTH_CHECK" | grep -q "ok"; then
  log "Health check passed: $HEALTH_CHECK"
else
  log "ERROR: Health check failed: $HEALTH_CHECK"
  restore_from_backup
  pm2 restart mcp-host
  [ -f "$NGINX_CONF" ] && sudo systemctl reload nginx
  exit 1
fi

log "===== DEPLOYMENT COMPLETED SUCCESSFULLY =====" 