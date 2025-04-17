import config from '../config.js';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
type LogData = Record<string, any>;

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};

class Logger {
  private level: number;
  private env: string;

  constructor() {
    this.env = config.NODE_ENV || 'development';
    this.level = LOG_LEVELS[config.LOG_LEVEL as LogLevel] || LOG_LEVELS.info;
  }

  private formatMessage(level: string, data: LogData | undefined, message: string): string {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const dataString = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [pid:${pid}] ${message}${dataString}`;
  }

  private log(level: LogLevel, data: LogData | undefined, message: string): void {
    if (LOG_LEVELS[level] >= this.level) {
      const formattedMessage = this.formatMessage(level, data, message);
      
      if (level === 'error' || level === 'fatal') {
        console.error(formattedMessage);
      } else if (level === 'warn') {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }
  }

  trace(data: LogData | string, message?: string): void {
    const [logData, logMessage] = typeof data === 'string' ? [undefined, data] : [data, message || ''];
    this.log('trace', logData, logMessage);
  }

  debug(data: LogData | string, message?: string): void {
    const [logData, logMessage] = typeof data === 'string' ? [undefined, data] : [data, message || ''];
    this.log('debug', logData, logMessage);
  }

  info(data: LogData | string, message?: string): void {
    const [logData, logMessage] = typeof data === 'string' ? [undefined, data] : [data, message || ''];
    this.log('info', logData, logMessage);
  }

  warn(data: LogData | string, message?: string): void {
    const [logData, logMessage] = typeof data === 'string' ? [undefined, data] : [data, message || ''];
    this.log('warn', logData, logMessage);
  }

  error(data: LogData | string, message?: string): void {
    const [logData, logMessage] = typeof data === 'string' ? [undefined, data] : [data, message || ''];
    this.log('error', logData, logMessage);
  }

  fatal(data: LogData | string, message?: string): void {
    const [logData, logMessage] = typeof data === 'string' ? [undefined, data] : [data, message || ''];
    this.log('fatal', logData, logMessage);
  }
}

const logger = new Logger();
logger.info({ env: config.NODE_ENV }, `Logger initialized with level: ${config.LOG_LEVEL}`);

export default logger;
