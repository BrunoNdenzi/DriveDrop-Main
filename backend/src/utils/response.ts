/**
 * HTTP response utilities
 */

/**
 * Standard API response format
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    errors?: unknown[];
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Success response helper
 */
export const successResponse = <T>(
  data: T,
  meta?: ApiResponse<T>['meta'],
): ApiResponse<T> => ({
  success: true,
  data,
  ...(meta && { meta }),
});

/**
 * Error response helper
 */
export const errorResponse = (
  message: string,
  code = 'INTERNAL_SERVER_ERROR',
  errors: unknown[] = [],
): ApiResponse<never> => ({
  success: false,
  error: {
    code,
    message,
    ...(errors.length > 0 && { errors }),
  },
});
