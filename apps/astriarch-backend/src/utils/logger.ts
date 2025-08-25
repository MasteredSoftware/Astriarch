import config from 'config';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = (config.get('loglevel') as LogLevel) || 'INFO';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
    return levels[level] >= levels[this.logLevel];
  }

  private formatPrefix(level: LogLevel): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${level}:`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatPrefix('DEBUG'), message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('INFO')) {
      console.log(this.formatPrefix('INFO'), message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatPrefix('WARN'), message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatPrefix('ERROR'), message, ...args);
    }
  }
}

export const logger = new Logger();
