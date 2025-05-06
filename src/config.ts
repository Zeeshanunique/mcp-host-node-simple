import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Set up environment based on environment
const env = process.env.NODE_ENV || 'development';
const envPath = path.resolve(process.cwd(), `.env.${env}`);
const defaultEnvPath = path.resolve(process.cwd(), '.env');

// First try environment-specific .env file, then fall back to default .env
if (fs.existsSync(envPath)) {
  console.log(`[Config] Loading environment variables from ${envPath}`);
  dotenv.config({ path: envPath });
} else if (fs.existsSync(defaultEnvPath)) {
  console.log(`[Config] Loading environment variables from ${defaultEnvPath}`);
  dotenv.config({ path: defaultEnvPath });
} else {
  console.log('[Config] No .env file found, using process environment variables');
}

// Define configuration schema with Zod for validation
const configSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000), // Keep for backward compatibility
  BACKEND_PORT: z.coerce.number().default(7564), // Default to required backend port
  FRONTEND_PORT: z.coerce.number().default(6754), // Default to required frontend port
  FRONTEND_URL: z.string().default('http://localhost:6754'),
  BASE_PATH: z.string().default('/mcp-host'), // Base path for Nginx proxy
  CORS_ORIGINS: z.string().default('*'),
  
  // API keys
  ANTHROPIC_API_KEY: z.string({
    required_error: "ANTHROPIC_API_KEY is required in .env file"
  }),
  GOOGLE_API_KEY: z.string({
    required_error: "GOOGLE_API_KEY is required in .env file"
  }),
  
  // MCP configuration
  MCP_CONFIG_PATH: z.string().default('./mcp-servers.json'),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60 * 1000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(60), // 60 requests per minute
});

// Parse environment variables with the schema
const config = configSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  BACKEND_PORT: process.env.BACKEND_PORT,
  FRONTEND_PORT: process.env.FRONTEND_PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  BASE_PATH: process.env.BASE_PATH,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  MCP_CONFIG_PATH: process.env.MCP_CONFIG_PATH,
  LOG_LEVEL: process.env.LOG_LEVEL,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
});

// Extend the config type with additional properties
type ExtendedConfig = typeof config & {
  API_PREFIX: string;
  FULL_API_PATH: string;
  IS_PRODUCTION: boolean;
  IS_DEVELOPMENT: boolean;
};

// Cast to the extended type and add derived properties
const extendedConfig = config as ExtendedConfig;

// Add derived properties
extendedConfig.API_PREFIX = '/api';
extendedConfig.FULL_API_PATH = `${extendedConfig.BASE_PATH}${extendedConfig.API_PREFIX}`;
extendedConfig.IS_PRODUCTION = extendedConfig.NODE_ENV === 'production';
extendedConfig.IS_DEVELOPMENT = extendedConfig.NODE_ENV === 'development';

export default extendedConfig;
