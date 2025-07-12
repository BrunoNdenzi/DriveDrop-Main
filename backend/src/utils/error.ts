/**
 * Error utilities
 */
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@middlewares/error.middleware';

/**
 * Create a standardized API error
 */
export const createError = (
  message: string,
  statusCode = 500,
  code = 'INTERNAL_SERVER_ERROR',
  errors: unknown[] = [],
): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.errors = errors;
  return error;
};

/**
 * Async handler to catch errors in async/await functions
 * This eliminates the need for try/catch blocks in controllers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
