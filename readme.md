# MCP Host

A Node.js TypeScript application with React frontend for hosting Model Context Protocol (MCP) tools.

## Features

- Express.js backend API for MCP tools
- React frontend for interactive chat and tool usage
- Support for multiple LLM providers (Anthropic, OpenAI, Azure OpenAI, Bedrock)
- MCP tools integration for enhanced AI capabilities
- Production-ready with optimized configurations

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Production Deployment](#production-deployment)
  - [AWS EC2 Deployment](#aws-ec2-deployment)
  - [Running in Production](#running-in-production)
  - [Nginx Configuration](#nginx-configuration)
  - [SSL Configuration](#ssl-configuration)
  - [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [MCP Tools](#mcp-tools)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18.x or higher
- PNPM 10.x or higher (recommended package manager)
- Git

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mcp-host-node-simple.git
   cd mcp-host-node-simple
   ```

2. Install dependencies:
   ```bash
   pnpm install
   pnpm run install:frontend
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. Build the application:
   ```bash
   pnpm run build:all
   ```

## Development

1. Start the development server:
   ```bash
   pnpm run dev:all
   ```

2. Access the application:
   - Backend API: http://localhost:3001
   - Frontend: http://localhost:3002

## Production Deployment

### AWS EC2 Deployment

#### 1. Set Up EC2 Instance

1. Launch an EC2 instance with the following specifications:
   - Ubuntu 22.04 LTS
   - t3.medium or larger (for subprocess handling)
   - At least 30GB SSD storage

2. Configure security groups:
   - SSH (TCP 22) - Your IP only
   - HTTP (TCP 80) - Anywhere
   - HTTPS (TCP 443) - Anywhere

#### 2. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Install PNPM
npm install -g pnpm@10.6.5

# Install build tools and Git
sudo apt install -y build-essential git python3 python3-pip

# Install PM2 for process management
npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

#### 3. Deploy Application

1. Create application directory:
   ```bash
   mkdir -p /home/ubuntu/apps
   cd /home/ubuntu/apps
   ```

2. Clone repository:
   ```bash
   git clone https://github.com/yourusername/mcp-host-node-simple.git
   cd mcp-host-node-simple
   ```

3. Install dependencies and build:
   ```bash
   pnpm install
   pnpm run install:frontend
   pnpm run build:all
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   nano .env
   # Add your API keys and configuration
   # Make sure NODE_ENV=production
   ```

### Running in Production

You have two options for running the application in production:

#### Option 1: Using PM2 (Recommended)

PM2 is the recommended approach for production as it provides process management, automatic restarts, and proper logging.

1. Start with PM2:
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

2. Enable PM2 to start on boot:
   ```bash
   pm2 save
   pm2 startup
   ```

#### Option 2: Using npm script

You can also run directly using the built-in production script:

```bash
npm run prod:all
```

However, this doesn't provide process management or automatic restarts like PM2.

#### 4. Automated Deployment

1. Make the deployment script executable:
   ```bash
   chmod +x deploy.sh
   ```

2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

   This script will:
   - Back up your current deployment
   - Pull the latest code
   - Install dependencies
   - Build the application
   - Restart using PM2
   - Verify the deployment

### Nginx Configuration

1. Create an Nginx configuration file:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/mcp-host
   ```

2. Edit the configuration:
   ```bash
   sudo nano /etc/nginx/sites-available/mcp-host
   # Replace 'your-domain.com' with your actual domain
   ```

3. Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/mcp-host /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### SSL Configuration

1. Install Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

2. Obtain SSL certificate:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. Certbot will automatically update your Nginx configuration with SSL settings.

### Monitoring and Maintenance

#### Health Checks

The application provides health and readiness endpoints:
- `/health` - Basic health check
- `/ready` - Detailed readiness check

#### Logs

View application logs:
```bash
pm2 logs mcp-host
```

View Nginx logs:
```bash
sudo tail -f /var/log/nginx/mcp-host.error.log
sudo tail -f /var/log/nginx/mcp-host.access.log
```

#### Backup

The deployment script automatically creates backups in `/home/ubuntu/backups/mcp-host` before each deployment.

#### Updates

To update the application:
```bash
cd /home/ubuntu/apps/mcp-host-node-simple
./deploy.sh
```

## Project Structure

```
mcp-host-node-simple/
├── dist/                # Compiled TypeScript output
├── src/
│   ├── backend/         # Express server
│   ├── frontend/        # React frontend
│   ├── utils/           # Utility functions
│   ├── config.ts        # Configuration settings
│   ├── mcp-host.ts      # MCP host implementation
│   └── mcp-transport.ts # MCP transport implementation
├── fixtures/            # MCP tool servers
├── .env                 # Environment variables
├── ecosystem.config.js  # PM2 configuration
├── nginx.conf          # Nginx configuration template
└── deploy.sh           # Deployment script
```

## Environment Variables

The application uses the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode (development/production) | development |
| PORT | Backend server port | 3001 |
| BACKEND_PORT | Same as PORT | 3001 |
| FRONTEND_PORT | Frontend server port | 3002 |
| CORS_ORIGINS | Allowed origins for CORS | * |
| ANTHROPIC_API_KEY | Anthropic API key | Required |
| GOOGLE_API_KEY | Google API key | Required |
| MCP_CONFIG_PATH | Path to MCP configuration | ./mcp-servers.json |
| LOG_LEVEL | Logger level | info |
| RATE_LIMIT_WINDOW_MS | Rate limit window in milliseconds | 60000 |
| RATE_LIMIT_MAX_REQUESTS | Maximum requests per window | 30 |

## MCP Tools

The application supports various MCP tools, which are defined in `mcp-servers.json`. Each tool is launched as a subprocess and provides specific functionality to the LLM.

To add new tools, update the `mcp-servers.json` file with the appropriate configuration.

## Troubleshooting

### Common Issues

#### MCP tools not loading
- Ensure the paths in `mcp-servers.json` are correct
- Check permissions on server script files
- Verify the tool dependencies are installed

#### Application not starting
- Check logs: `pm2 logs mcp-host`
- Verify environment variables are set correctly
- Ensure all dependencies are installed

#### Nginx not serving the application
- Check Nginx configuration: `sudo nginx -t`
- Verify the paths in the configuration file
- Check Nginx logs for errors
