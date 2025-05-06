/**
 * Frontend application configuration
 * Handles base path and API URL settings for both development and production environments
 */

// Determine the environment
const isProduction = process.env.NODE_ENV === 'production';

// Base path configuration for routing
export const basePath = isProduction ? '/mcp-host' : '';

// API endpoint configuration
export const apiPath = `${basePath}/api`;

// Configuration object
const appConfig = {
  // Base path for the application when behind reverse proxy
  basePath,
  
  // API endpoints path
  apiPath,
  
  // Environment helpers
  isProduction,
  isDevelopment: !isProduction,
  
  // Port configuration (for local development only)
  frontendPort: 6754,
  backendPort: 7564,
};

export default appConfig;
