/**
 * Supabase JWT authentication middleware
 * Alternative to custom JWT - validates Supabase auth tokens directly
 */
import { Request, Response, NextFunction } from 'express';
import { supabase } from '@lib/supabase';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';

/**
 * Middleware to authenticate using Supabase JWT tokens
 * This validates tokens issued by Supabase Auth
 */
export const authenticateSupabaseJWT = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      throw createError('Authentication token is required', 401, 'UNAUTHORIZED');
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Invalid Supabase token', { error: error?.message });
      throw createError('Invalid authentication token', 401, 'UNAUTHORIZED');
    }

    // Get user profile from our profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, first_name, last_name, is_verified')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('User profile not found', { userId: user.id, error: profileError });
      throw createError('User profile not found', 401, 'UNAUTHORIZED');
    }

    // Check if user is verified (optional check)
    if (!profile.is_verified) {
      throw createError('Account not verified', 401, 'UNVERIFIED_ACCOUNT');
    }

    // Attach user to request
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
    };

    // Attach additional user info for convenience
    (req as any).userProfile = profile;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate resource ownership
 * Ensures users can only access their own resources
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
