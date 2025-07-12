/**
 * Shipment routes
 */
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { 
  getShipmentById,
  getShipments,
  createShipment,
  updateShipmentStatus,
  getShipmentsNearby,
  getShipmentTracking,
  createTrackingEvent
} from '@controllers/shipment.controller';

const router = Router();

/**
 * @route GET /api/v1/shipments
 * @desc Get all shipments (with pagination and filters)
 * @access Private
 */
router.get('/', authenticate, getShipments);

/**
 * @route POST /api/v1/shipments
 * @desc Create a new shipment
 * @access Private (Client)
 */
router.post('/', authenticate, authorize(['client']), createShipment);

/**
 * @route GET /api/v1/shipments/nearby
 * @desc Get shipments near location
 * @access Private (Driver)
 */
router.get('/nearby', authenticate, authorize(['driver']), getShipmentsNearby);

/**
 * @route GET /api/v1/shipments/:id
 * @desc Get shipment by ID
 * @access Private
 */
router.get('/:id', authenticate, getShipmentById);

/**
 * @route PATCH /api/v1/shipments/:id/status
 * @desc Update shipment status
 * @access Private (Driver/Admin)
 */
router.patch('/:id/status', authenticate, authorize(['driver', 'admin']), updateShipmentStatus);

/**
 * @route GET /api/v1/shipments/:id/tracking
 * @desc Get shipment tracking events
 * @access Private
 */
router.get('/:id/tracking', authenticate, getShipmentTracking);

/**
 * @route POST /api/v1/shipments/:id/events
 * @desc Create tracking event
 * @access Private (Driver or Admin)
 */
router.post('/:id/events', authenticate, authorize(['driver', 'admin']), createTrackingEvent);

export default router;
