/**
 * Pickup Verification Controller
 * Handles HTTP requests for driver pickup verification system
 */
import { Request, Response, NextFunction } from 'express';
import { createError } from '../utils/error';
import PickupVerificationService from '../services/pickupVerification.service';

/**
 * POST /api/v1/shipments/:id/driver-en-route
 * Mark driver as en route to pickup
 */
export const markDriverEnRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { location } = req.body;
    const driverId = req.user!.id;
    
    if (!id) {
      throw createError('Shipment ID is required', 400, 'INVALID_REQUEST');
    }

    // Validate request
    if (!location || !location.lat || !location.lng) {
      throw createError('Location coordinates (lat, lng) are required', 400, 'INVALID_REQUEST');
    }

    await PickupVerificationService.markDriverEnRoute(id, driverId, location);

    res.status(200).json({
      success: true,
      message: 'Driver marked as en route',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/shipments/:id/driver-arrived
 * Mark driver as arrived at pickup (GPS verified)
 */
export const markDriverArrived = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { location } = req.body;
    const driverId = req.user!.id;
    
    if (!id) {
      throw createError('Shipment ID is required', 400, 'INVALID_REQUEST');
    }

    // Validate request
    if (!location || !location.lat || !location.lng || location.accuracy === undefined) {
      throw createError('Location coordinates (lat, lng, accuracy) are required', 400, 'INVALID_REQUEST');
    }

    await PickupVerificationService.markDriverArrived(id, driverId, location);

    res.status(200).json({
      success: true,
      message: 'Driver marked as arrived',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/shipments/:id/start-verification
 * Initialize pickup verification process
 */
export const startVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { location } = req.body;
    const driverId = req.user!.id;
    
    if (!id) {
      throw createError('Shipment ID is required', 400, 'INVALID_REQUEST');
    }

    // Validate request
    if (!location || !location.lat || !location.lng || location.accuracy === undefined) {
      throw createError('Location coordinates (lat, lng, accuracy) are required', 400, 'INVALID_REQUEST');
    }

    const verification = await PickupVerificationService.startVerification(
      id,
      driverId,
      { shipmentId: id, location }
    );

    res.status(201).json({
      success: true,
      message: 'Verification started',
      data: { verification },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/shipments/:id/verification-photos
 * Upload a verification photo
 */
export const uploadVerificationPhoto = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { verificationId, angle, photoUrl, location } = req.body;

    // Validate request
    if (!verificationId || !angle || !photoUrl || !location) {
      throw createError('verificationId, angle, photoUrl, and location are required', 400, 'INVALID_REQUEST');
    }

    if (!location.lat || !location.lng) {
      throw createError('Location coordinates (lat, lng) are required', 400, 'INVALID_REQUEST');
    }

    const photo = await PickupVerificationService.uploadVerificationPhoto(
      verificationId,
      angle,
      photoUrl,
      location
    );

    res.status(200).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: { photo },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/shipments/:id/submit-verification
 * Submit completed verification with decision
 */
export const submitVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { verificationId, decision, differences, driverNotes, location } = req.body;
    const driverId = req.user!.id;
    
    if (!id) {
      throw createError('Shipment ID is required', 400, 'INVALID_REQUEST');
    }

    // Validate request
    if (!verificationId || !decision || !location) {
      throw createError('verificationId, decision, and location are required', 400, 'INVALID_REQUEST');
    }

    if (!['matches', 'minor_differences', 'major_issues'].includes(decision)) {
      throw createError('decision must be: matches, minor_differences, or major_issues', 400, 'INVALID_DECISION');
    }

    if (!location.lat || !location.lng) {
      throw createError('Location coordinates (lat, lng) are required', 400, 'INVALID_REQUEST');
    }

    const result = await PickupVerificationService.submitVerification(
      id,
      driverId,
      {
        verificationId,
        decision,
        differences,
        driverNotes,
        location,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Verification submitted successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/shipments/:id/client-response
 * Client approves or disputes minor differences
 */
export const clientRespondToVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { verificationId, response, notes } = req.body;
    const clientId = req.user!.id;
    
    if (!id) {
      throw createError('Shipment ID is required', 400, 'INVALID_REQUEST');
    }

    // Validate request
    if (!verificationId || !response) {
      throw createError('verificationId and response are required', 400, 'INVALID_REQUEST');
    }

    if (!['approved', 'disputed'].includes(response)) {
      throw createError('response must be: approved or disputed', 400, 'INVALID_RESPONSE');
    }

    const verification = await PickupVerificationService.clientRespondToVerification(
      id,
      clientId,
      {
        verificationId,
        response,
        notes,
      }
    );

    res.status(200).json({
      success: true,
      message: `Verification ${response}`,
      data: { verification },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/shipments/:id/cancel-at-pickup
 * Cancel shipment at pickup due to mismatch or fraud
 */
export const cancelAtPickup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { cancellationType, reason, pickupVerificationId, evidenceUrls, fraudConfirmed } = req.body;
    const userId = req.user!.id;
    
    if (!id) {
      throw createError('Shipment ID is required', 400, 'INVALID_REQUEST');
    }

    // Validate request
    if (!cancellationType || !reason) {
      throw createError('cancellationType and reason are required', 400, 'INVALID_REQUEST');
    }

    const validTypes = [
      'before_driver_accepts',
      'after_accept_before_arrival',
      'at_pickup_mismatch',
      'at_pickup_fraud',
      'in_transit_emergency',
      'admin_intervention',
    ];

    if (!validTypes.includes(cancellationType)) {
      throw createError(`cancellationType must be one of: ${validTypes.join(', ')}`, 400, 'INVALID_CANCELLATION_TYPE');
    }

    const cancellation = await PickupVerificationService.cancelAtPickup(
      id,
      userId,
      {
        cancellationType,
        reason,
        pickupVerificationId,
        evidenceUrls,
        fraudConfirmed,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Shipment cancelled',
      data: { cancellation },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/shipments/:id/status
 * Update shipment status (picked_up, in_transit, delivered)
 */
export const updateShipmentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const driverId = req.user!.id;
    
    if (!id) {
      throw createError('Shipment ID is required', 400, 'INVALID_REQUEST');
    }

    // Validate request
    if (!status) {
      throw createError('status is required', 400, 'INVALID_REQUEST');
    }

    if (!['picked_up', 'in_transit', 'delivered'].includes(status)) {
      throw createError('status must be: picked_up, in_transit, or delivered', 400, 'INVALID_STATUS');
    }

    // Handle each status
    if (status === 'picked_up') {
      await PickupVerificationService.markPickedUp(id, driverId);
    } else if (status === 'in_transit') {
      await PickupVerificationService.markInTransit(id, driverId);
    } else {
      // For delivered status, we would need additional logic (photos, signature, etc.)
      throw createError('Delivered status update not yet implemented', 501, 'NOT_IMPLEMENTED');
    }

    res.status(200).json({
      success: true,
      message: `Shipment status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/shipments/:id/verification
 * Get pickup verification for a shipment
 */
export const getVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      throw createError('Shipment ID is required', 400, 'INVALID_REQUEST');
    }

    const verification = await PickupVerificationService.getVerification(id);

    if (!verification) {
      throw createError('No verification found for this shipment', 404, 'VERIFICATION_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: { verification },
    });
  } catch (error) {
    next(error);
  }
};
