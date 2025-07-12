/**
 * Error handling middleware
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  errors?: unknown[];
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'Something went wrong';
  const errors = err.errors || [];

  // Log the error (but not in test environment)
  if (process.env['NODE_ENV'] !== 'test') {
    logger.error(`[ERROR] ${statusCode} - ${message}`, {
      error: err.stack,
      errorCode,
      statusCode,
    });
  }

  // Hide error details in production
  const responseBody = {
    success: false,
    error: {
      code: errorCode,
      message: process.env['NODE_ENV'] === 'production' && statusCode === 500 
        ? 'Internal Server Error' 
        : message,
      ...(errors.length > 0 && { errors }),
    },
  };

  res.status(statusCode).json(responseBody);
};

/**
 * 404 handler middleware
 */
export const notFoundHandler = (req: Request, res: Response) => {
  // Safely handle req.originalUrl which could be a full URL or path
  const path = req.originalUrl.includes('://') 
    ? 'external URL' // Avoid passing full URLs to the response
    : req.originalUrl;
    
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${path} not found`,
    },
  });
};
