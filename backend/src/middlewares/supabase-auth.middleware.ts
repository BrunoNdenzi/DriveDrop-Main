/**
 * Supabase JWT authentication middleware - Extended functionality
 * Provides resource-level authorization functionality
 */
import { Request, Response, NextFunction } from 'express';
import { supabase } from '@lib/supabase';
import { createError } from '@utils/error';
// import { logger } from '@utils/logger';

/**
 * Validates resource ownership by checking if the authenticated user
 * has rights to access the requested resource.
 * 
 * This is a more specific authorization middleware that extends the
 * basic role-based authorization.
 */
export const validateResourceOwnership = (resourceIdParam = 'id', allowedRoles: string[] = ['admin']) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      // Admins can access any resource
      if (allowedRoles.includes(req.user.role)) {
        return next();
      }

      const resourceId = req.params[resourceIdParam];
      
      // For user resources, check if accessing own profile
      if (req.baseUrl.includes('/users')) {
        if (resourceId === req.user.id || resourceId === 'me') {
          return next();
        }
        throw createError('Access denied', 403, 'FORBIDDEN');
      }

      // For shipment resources, check ownership
      if (req.baseUrl.includes('/shipments')) {
        const { data: shipment, error } = await supabase
          .from('shipments')
          .select('client_id, driver_id')
          .eq('id', resourceId)
          .single();

        if (error || !shipment) {
          throw createError('Shipment not found', 404, 'NOT_FOUND');
        }

        const hasAccess = shipment.client_id === req.user.id || 
                         shipment.driver_id === req.user.id;

        if (!hasAccess) {
          throw createError('Access denied', 403, 'FORBIDDEN');
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
