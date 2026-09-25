import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(level: string): Logger {
  return pino({
    name: 'twake-sessions-service',
    level: process.env.NODE_ENV === 'test' ? 'silent' : level,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
