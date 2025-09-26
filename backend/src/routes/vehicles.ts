/**
 * Vehicle management routes
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { vehicleService } from '../services/vehicle.service';
import { ApiResponse, successResponse, errorResponse } from '@utils/response';
import { logger } from '@utils/logger';

const router = Router();

// All vehicle routes require authentication
router.use(authenticate);

/**
 * GET /api/vehicles
 * Get all vehicles for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const activeOnly = req.query['active_only'] === 'true';
    const pagination = req.query['page'] && req.query['limit'] ? {
      page: parseInt(req.query['page'] as string),
      limit: parseInt(req.query['limit'] as string),
    } : undefined;

    const result = await vehicleService.getUserVehicles(userId, activeOnly, pagination);

    const response: ApiResponse<any> = successResponse(result.vehicles, result.meta);
    res.json(response);
  } catch (error: any) {
    logger.error('Error fetching user vehicles', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('Failed to fetch vehicles'));
  }
});

/**
 * GET /api/vehicles/primary
 * Get user's primary vehicle
 */
router.get('/primary', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const vehicle = await vehicleService.getPrimaryVehicle(userId);

    const response: ApiResponse<any> = successResponse(vehicle);
    res.json(response);
  } catch (error: any) {
    logger.error('Error fetching primary vehicle', { error, userId: req.user?.id });
    res.status(500).json(errorResponse('Failed to fetch primary vehicle'));
  }
});

/**
 * GET /api/vehicles/:id
 * Get a specific vehicle by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const vehicleId = req.params['id'];

    if (!vehicleId) {
      res.status(400).json(errorResponse('Vehicle ID is required', 'MISSING_VEHICLE_ID'));
      return;
    }

    const vehicle = await vehicleService.getVehicleById(vehicleId, userId);

    const response: ApiResponse<any> = successResponse(vehicle);
    res.json(response);
  } catch (error: any) {
    logger.error('Error fetching vehicle', { error, vehicleId: req.params['id'], userId: req.user?.id });
    
    if (error.code === 'VEHICLE_NOT_FOUND') {
      res.status(404).json(errorResponse('Vehicle not found', 'VEHICLE_NOT_FOUND'));
    } else {
      res.status(500).json(errorResponse('Failed to fetch vehicle'));
    }
  }
});

/**
 * POST /api/vehicles
 * Create a new vehicle
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const vehicleData = req.body;

    // Basic validation
    if (!vehicleData.vehicle_type || !vehicleData.make || !vehicleData.model || !vehicleData.year) {
      return res.status(400).json(errorResponse('Missing required fields', 'VALIDATION_ERROR'));
    }

    const vehicle = await vehicleService.createVehicle(userId, vehicleData);

    const response: ApiResponse<any> = successResponse(vehicle);
    res.status(201).json(response);
    return;
  } catch (error: any) {
    logger.error('Error creating vehicle', { error, userId: req.user?.id, vehicleData: req.body });
    
    if (error.code === 'NICKNAME_EXISTS') {
      res.status(409).json(errorResponse('Vehicle nickname already exists', 'NICKNAME_EXISTS'));
    } else if (error.code === 'INVALID_YEAR') {
      res.status(400).json(errorResponse('Invalid vehicle year', 'INVALID_YEAR'));
    } else {
      res.status(500).json(errorResponse('Failed to create vehicle'));
    }
    return;
  }
});

/**
 * PUT /api/vehicles/:id
 * Update a vehicle
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const vehicleId = req.params['id'];
    const updates = req.body;

    if (!vehicleId) {
      res.status(400).json(errorResponse('Vehicle ID is required', 'MISSING_VEHICLE_ID'));
      return;
    }

    const vehicle = await vehicleService.updateVehicle(vehicleId, userId, updates);

    const response: ApiResponse<any> = successResponse(vehicle);
    res.json(response);
  } catch (error: any) {
    logger.error('Error updating vehicle', { error, vehicleId: req.params['id'], userId: req.user?.id });
    
    if (error.code === 'VEHICLE_NOT_FOUND') {
      res.status(404).json(errorResponse('Vehicle not found', 'VEHICLE_NOT_FOUND'));
    } else if (error.code === 'NICKNAME_EXISTS') {
      res.status(409).json(errorResponse('Vehicle nickname already exists', 'NICKNAME_EXISTS'));
    } else if (error.code === 'INVALID_YEAR') {
      res.status(400).json(errorResponse('Invalid vehicle year', 'INVALID_YEAR'));
    } else {
      res.status(500).json(errorResponse('Failed to update vehicle'));
    }
  }
});

/**
 * PUT /api/vehicles/:id/primary
 * Set a vehicle as primary
 */
router.put('/:id/primary', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const vehicleId = req.params['id'];

    if (!vehicleId) {
      res.status(400).json(errorResponse('Vehicle ID is required', 'MISSING_VEHICLE_ID'));
      return;
    }

    const vehicle = await vehicleService.setPrimaryVehicle(vehicleId, userId);

    const response: ApiResponse<any> = successResponse(vehicle);
    res.json(response);
  } catch (error: any) {
    logger.error('Error setting primary vehicle', { error, vehicleId: req.params['id'], userId: req.user?.id });
    
    if (error.code === 'VEHICLE_NOT_FOUND') {
      res.status(404).json(errorResponse('Vehicle not found', 'VEHICLE_NOT_FOUND'));
    } else {
      res.status(500).json(errorResponse('Failed to set primary vehicle'));
    }
  }
});

/**
 * DELETE /api/vehicles/:id
 * Delete a vehicle (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const vehicleId = req.params['id'];

    if (!vehicleId) {
      res.status(400).json(errorResponse('Vehicle ID is required', 'MISSING_VEHICLE_ID'));
      return;
    }

    await vehicleService.deleteVehicle(vehicleId, userId);

    const response: ApiResponse<any> = successResponse(null);
    res.json(response);
  } catch (error: any) {
    logger.error('Error deleting vehicle', { error, vehicleId: req.params['id'], userId: req.user?.id });
    
    if (error.code === 'VEHICLE_NOT_FOUND') {
      res.status(404).json(errorResponse('Vehicle not found', 'VEHICLE_NOT_FOUND'));
    } else {
      res.status(500).json(errorResponse('Failed to delete vehicle'));
    }
  }
});

export default router;