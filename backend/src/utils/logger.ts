/**
 * Logger utility
 */
import { Request, Response, NextFunction } from 'express';
import config from '@config';

// Simple logger with colored output and timestamp
export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (config.logging.level === 'debug') {
      console.debug(`\x1b[36m[DEBUG]\x1b[0m ${new Date().toISOString()} - ${message}`, meta || '');
    }
  },
  
  info: (message: string, meta?: Record<string, unknown>) => {
    if (['debug', 'info'].includes(config.logging.level)) {
      console.info(`\x1b[32m[INFO]\x1b[0m ${new Date().toISOString()} - ${message}`, meta || '');
    }
  },
  
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (['debug', 'info', 'warn'].includes(config.logging.level)) {
      console.warn(`\x1b[33m[WARN]\x1b[0m ${new Date().toISOString()} - ${message}`, meta || '');
    }
  },
  
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${new Date().toISOString()} - ${message}`, meta || '');
  },
};

// Add request logging middleware
export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
};
