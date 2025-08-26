/**
 * Health check controller
 */
import { Request, Response } from 'express';
import { successResponse } from '@utils/response';
import { supabase } from '@lib/supabase';
import { logger } from '@utils/logger';
import { asyncHandler } from '@utils/error';

/**
 * Simple health check endpoint
 * @route GET /health
 * @access Public
 */
export const getHealth = (_req: Request, res: Response) => {
  res.status(200).json(
    successResponse({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'DriveDrop API',
      environment: process.env['NODE_ENV'] || 'development',
    })
  );
};

/**
 * Database health check endpoint
 * @route GET /health/db
 * @access Public
 */
export const getDatabaseHealth = asyncHandler(
  async (_req: Request, res: Response) => {
    // Check Supabase connection
    const start = Date.now();
    const { error } = await supabase.from('profiles').select('count').limit(1);
    const responseTime = Date.now() - start;

    if (error) {
      logger.error('Database health check failed', { error });
      throw error;
    }

    res.status(200).json(
      successResponse({
        status: 'OK',
        database: 'Supabase',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      })
    );
  }
);
