import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment-specific .env file if it exists (e.g., .env.production)
const nodeEnv = process.env.NODE_ENV || 'development';
const envPath = path.resolve(process.cwd(), `.env.${nodeEnv}`);
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
  PORT: z.coerce.number().default(3001), // Keep for backward compatibility
  BACKEND_PORT: z.coerce.number().default(3001),
  FRONTEND_PORT: z.coerce.number().default(3002),
  FRONTEND_URL: z.string().default('http://localhost:3002'),
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
  PORT: process.env.BACKEND_PORT || process.env.PORT, // Try BACKEND_PORT first, then fall back to PORT
  BACKEND_PORT: process.env.BACKEND_PORT || process.env.PORT, // Try BACKEND_PORT first, then fall back to PORT
  FRONTEND_PORT: process.env.FRONTEND_PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  MCP_CONFIG_PATH: process.env.MCP_CONFIG_PATH,
  LOG_LEVEL: process.env.LOG_LEVEL,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
});

export default config;
