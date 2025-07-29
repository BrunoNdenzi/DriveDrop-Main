/**
 * Driver routes
 */
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { 
  getDriverApplications
} from '@controllers/application.controller';

const router = Router();

/**
 * @route GET /api/v1/drivers/applications
 * @desc Get all applications for the authenticated driver
 * @access Private (Driver)
 * @query status - Optional filter by application status (pending, accepted, rejected)
 * @example 
 * GET /api/v1/drivers/applications
 * GET /api/v1/drivers/applications?status=pending
 */
router.get('/applications', authenticate, authorize(['driver']), getDriverApplications);

export default router;
