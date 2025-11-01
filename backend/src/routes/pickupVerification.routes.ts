/**
 * Pickup Verification Routes
 * Routes for driver pickup verification system
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  markDriverEnRoute,
  markDriverArrived,
  startVerification,
  uploadVerificationPhoto,
  submitVerification,
  clientRespondToVerification,
  cancelAtPickup,
  updateShipmentStatus,
  getVerification,
} from '../controllers/pickupVerification.controller';

const router = Router();

// Debug log to verify routes are loading
console.log('[DEBUG] Pickup Verification Routes loaded!');

/**
 * @route POST /api/v1/shipments/:id/driver-en-route
 * @desc Mark driver as en route to pickup
 * @access Private (Driver only)
 */
router.post('/:id/driver-en-route', authenticate, authorize(['driver']), markDriverEnRoute);

/**
 * @route POST /api/v1/shipments/:id/driver-arrived
 * @desc Mark driver as arrived at pickup (GPS verified)
 * @access Private (Driver only)
 */
router.post('/:id/driver-arrived', authenticate, authorize(['driver']), markDriverArrived);

/**
 * @route POST /api/v1/shipments/:id/start-verification
 * @desc Initialize pickup verification process
 * @access Private (Driver only)
 */
router.post('/:id/start-verification', authenticate, authorize(['driver']), startVerification);

/**
 * @route POST /api/v1/shipments/:id/verification-photos
 * @desc Upload a verification photo
 * @access Private (Driver only)
 */
router.post('/:id/verification-photos', authenticate, authorize(['driver']), uploadVerificationPhoto);

/**
 * @route POST /api/v1/shipments/:id/submit-verification
 * @desc Submit completed verification with decision
 * @access Private (Driver only)
 */
router.post('/:id/submit-verification', authenticate, authorize(['driver']), submitVerification);

/**
 * @route POST /api/v1/shipments/:id/client-response
 * @desc Client approves or disputes minor differences
 * @access Private (Client only)
 */
router.post('/:id/client-response', authenticate, authorize(['client']), clientRespondToVerification);

/**
 * @route POST /api/v1/shipments/:id/cancel-at-pickup
 * @desc Cancel shipment at pickup due to mismatch or fraud
 * @access Private (Driver, Client, or Admin)
 */
router.post('/:id/cancel-at-pickup', authenticate, authorize(['driver', 'client', 'admin']), cancelAtPickup);

/**
 * @route PATCH /api/v1/shipments/:id/pickup-status
 * @desc Update shipment status (picked_up, in_transit)
 * @access Private (Driver only)
 */
router.patch('/:id/pickup-status', authenticate, authorize(['driver']), updateShipmentStatus);

/**
 * @route GET /api/v1/shipments/:id/verification
 * @desc Get pickup verification for a shipment
 * @access Private (Driver, Client, or Admin)
 */
router.get('/:id/verification', authenticate, authorize(['driver', 'client', 'admin']), getVerification);

export default router;
