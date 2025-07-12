/**
 * Health check routes
 */
import { Router } from 'express';
import { getHealth, getDatabaseHealth } from '@controllers/health.controller';

const router = Router();

/**
 * @route GET /health
 * @desc Basic health check
 * @access Public
 */
router.get('/', getHealth);

/**
 * @route GET /health/db
 * @desc Database health check
 * @access Public
 */
router.get('/db', getDatabaseHealth);

export default router;
