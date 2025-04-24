import pino from 'pino';
import config from '../config.js';

const logger = pino({
  level: config.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: process.env.NODE_ENV !== 'production',
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  },
  base: {
    env: process.env.NODE_ENV,
    service: 'mcp-host'
  }
});

export default logger; 