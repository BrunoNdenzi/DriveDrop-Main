/**
 * Application controller
 */
import { Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { supabase } from '@lib/supabase';
import { isValidUuid } from '@utils/validation';
import { logger } from '@utils/logger';

/**
 * Apply for a shipment
 * @route POST /api/v1/shipments/:id/apply
 * @access Private (Driver)
 */
export const applyForShipment = asyncHandler(
  async (req: Request, res: Response) => {
    const { id: shipmentId } = req.params;
    const { notes } = req.body;

    if (!shipmentId || !isValidUuid(shipmentId)) {
      throw createError('Invalid shipment ID', 400, 'INVALID_ID');
    }

    if (!req.user?.id) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (req.user.role !== 'driver') {
      throw createError(
        'Only drivers can apply for shipments',
        403,
        'FORBIDDEN'
      );
    }

    try {
      const { data: result, error } = await supabase.rpc('apply_for_shipment', {
        p_shipment_id: shipmentId,
        p_driver_id: req.user.id,
        p_notes: notes || null,
      });

      if (error) {
        logger.error('Error applying for shipment', {
          error,
          shipmentId,
          driverId: req.user.id,
        });
        throw createError(error.message, 400, 'APPLICATION_FAILED');
      }

      res.status(201).json(successResponse(result));
    } catch (error: unknown) {
      // Special handling for known PostgreSQL exceptions from the stored procedure
      if (error instanceof Error) {
        if (
          error.message?.includes('This shipment has already been assigned')
        ) {
          throw createError(
            'This shipment already has a driver assigned',
            400,
            'ALREADY_ASSIGNED'
          );
        } else if (error.message?.includes('Shipment not found')) {
          throw createError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND');
        } else if (error.message?.includes('not available for applications')) {
          throw createError(
            'This shipment is not available for applications',
            400,
            'NOT_AVAILABLE'
          );
        }
      }

      throw error;
    }
  }
);

/**
 * Get driver's applications
 * @route GET /api/v1/drivers/applications
 * @access Private (Driver)
 */
export const getDriverApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const status = req.query['status'] as string | undefined;

    if (!req.user?.id) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (req.user.role !== 'driver') {
      throw createError(
        'Only drivers can view their applications',
        403,
        'FORBIDDEN'
      );
    }

    try {
      const { data, error } = await supabase.rpc('get_driver_applications', {
        p_driver_id: req.user.id,
        p_status: status || null,
      });

      if (error) {
        logger.error('Error getting driver applications', {
          error,
          driverId: req.user.id,
          status,
        });
        throw createError(error.message, 500, 'DATABASE_ERROR');
      }

      res.status(200).json(successResponse(data || []));
    } catch (error) {
      logger.error('Error in getDriverApplications', { error });
      throw error;
    }
  }
);

/**
 * Update application status
 * @route PUT /api/v1/applications/:id/status
 * @access Private (Admin or Driver - drivers can only cancel their own applications)
 */
export const updateApplicationStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id: applicationId } = req.params;
    const { status, notes } = req.body;

    if (!applicationId || !isValidUuid(applicationId)) {
      throw createError('Invalid application ID', 400, 'INVALID_ID');
    }

    if (
      !status ||
      !['pending', 'accepted', 'rejected', 'cancelled'].includes(status)
    ) {
      throw createError(
        'Invalid status. Must be pending, accepted, rejected, or cancelled',
        400,
        'INVALID_STATUS'
      );
    }

    if (!req.user?.id) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Check authorization based on role and status
    if (req.user.role === 'driver') {
      // Drivers can only cancel their own applications
      if (status !== 'cancelled') {
        throw createError(
          'Drivers can only cancel their own applications',
          403,
          'FORBIDDEN'
        );
      }

      // Verify the application belongs to the driver
      const { data: application, error: checkError } = await supabase
        .from('job_applications')
        .select('driver_id')
        .eq('id', applicationId)
        .single();

      if (checkError || !application) {
        throw createError('Application not found', 404, 'NOT_FOUND');
      }

      if (application.driver_id !== req.user.id) {
        throw createError(
          'You can only cancel your own applications',
          403,
          'FORBIDDEN'
        );
      }
    } else if (req.user.role !== 'admin') {
      throw createError(
        'Only admins and drivers can update application status',
        403,
        'FORBIDDEN'
      );
    }

    try {
      const { data, error } = await supabase.rpc('update_application_status', {
        p_application_id: applicationId,
        p_status: status,
        p_notes: notes || null,
      });

      if (error) {
        logger.error('Error updating application status', {
          error,
          applicationId,
          status,
        });
        throw createError(error.message, 400, 'UPDATE_FAILED');
      }

      if (!data) {
        throw createError('Application not found', 404, 'NOT_FOUND');
      }

      res.status(200).json(successResponse(data));
    } catch (error) {
      logger.error('Error in updateApplicationStatus', { error });
      throw error;
    }
  }
);

/**
 * Get all applications (admin only)
 * @route GET /api/v1/applications
 * @access Private (Admin)
 */
export const getAllApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const { status, shipmentId, limit = '50', offset = '0' } = req.query;

    if (!req.user?.id) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (req.user.role !== 'admin') {
      throw createError('Admin access required', 403, 'FORBIDDEN');
    }

    try {
      let query = supabase
        .from('job_applications')
        .select(
          `
        id,
        status,
        applied_at,
        notes,
        shipment:shipment_id(
          id,
          pickup_location,
          delivery_location,
          pickup_date,
          status,
          price
        ),
        driver:driver_id(
          id,
          first_name,
          last_name,
          email,
          phone,
          avatar_url
        )
      `
        )
        .order('applied_at', { ascending: false })
        .range(
          parseInt(offset as string),
          parseInt(offset as string) + parseInt(limit as string) - 1
        );

      // Apply filters if provided
      if (status) {
        query = query.eq('status', status);
      }

      if (shipmentId) {
        query = query.eq('shipment_id', shipmentId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error getting all applications', {
          error,
          status,
          shipmentId,
        });
        throw createError(error.message, 500, 'DATABASE_ERROR');
      }

      res.status(200).json(successResponse(data || []));
    } catch (error) {
      logger.error('Error in getAllApplications', { error });
      throw error;
    }
  }
);
