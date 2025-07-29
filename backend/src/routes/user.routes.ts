/**
 * User routes
 */
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { 
  getCurrentUser, 
  getUserById, 
  getUsers,
  updateCurrentUser,
  updateUserRating,
  getDriversNearby
} from '@controllers/user.controller';
import { getDriverApplications } from '@controllers/application.controller';

const router = Router();

/**
 * @route GET /api/v1/users/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, getCurrentUser);

/**
 * @route PUT /api/v1/users/me
 * @desc Update current user profile
 * @access Private
 */
router.put('/me', authenticate, updateCurrentUser);

/**
 * @route GET /api/v1/users/drivers/nearby
 * @desc Get drivers near location
 * @access Private (Client)
 */
router.get('/drivers/nearby', authenticate, authorize(['client']), getDriversNearby);

/**
 * @route GET /api/v1/users/drivers/applications
 * @desc Get driver's applications
 * @access Private (Driver)
 */
router.get('/drivers/applications', authenticate, authorize(['driver']), getDriverApplications);

/**
 * @route GET /api/v1/users/:id
 * @desc Get user by ID
 * @access Private (Admin)
 */
router.get('/:id', authenticate, authorize(['admin']), getUserById);

/**
 * @route PATCH /api/v1/users/:id/rating
 * @desc Update user rating
 * @access Private (Admin)
 */
router.patch('/:id/rating', authenticate, authorize(['admin']), updateUserRating);

/**
 * @route GET /api/v1/users
 * @desc Get all users (with pagination)
 * @access Private (Admin)
 */
router.get('/', authenticate, authorize(['admin']), getUsers);

export default router;
