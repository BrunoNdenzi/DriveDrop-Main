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
  createTrackingEvent,
  assignDriverToShipment,
  getShipmentApplicants
} from '@controllers/shipment.controller';
import { applyForShipment } from '@controllers/application.controller';

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

/**
 * @route PUT /api/v1/shipments/:id/assign
 * @desc Assign a driver to a shipment
 * @access Private (Admin only)
 */
router.put('/:id/assign', authenticate, authorize(['admin']), assignDriverToShipment);

/**
 * @route GET /api/v1/shipments/:id/applicants
 * @desc Get shipment applicants
 * @access Private (Admin only)
 */
router.get('/:id/applicants', authenticate, authorize(['admin']), getShipmentApplicants);

/**
 * @route POST /api/v1/shipments/:id/apply
 * @desc Apply for a shipment (Driver only)
 * @access Private (Driver only)
 */
router.post('/:id/apply', authenticate, authorize(['driver']), applyForShipment);

export default router;
