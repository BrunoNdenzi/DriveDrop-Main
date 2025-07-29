/**
 * Application routes
 */
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { 
  updateApplicationStatus,
  getDriverApplications,
  getAllApplications
} from '@controllers/application.controller';

const router = Router();

/**
 * @route GET /api/v1/applications
 * @desc Get all applications (admin only)
 * @access Private (Admin)
 */
router.get('/', authenticate, authorize(['admin']), getAllApplications);

/**
 * @route PUT /api/v1/applications/:id/status
 * @desc Update application status (accept/reject)
 * @access Private (Admin or Driver - drivers can only cancel their own applications)
 */
router.put('/:id/status', authenticate, updateApplicationStatus);

/**
 * @route GET /api/v1/applications/driver/:driverId
 * @desc Get applications for a specific driver (admin only)
 * @access Private (Admin)
 */
router.get('/driver/:driverId', authenticate, authorize(['admin']), getDriverApplications);

export default router;
