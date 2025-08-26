/**
 * Authentication middleware
 * Uses Supabase Auth tokens directly for authentication
 */
import { Request, Response, NextFunction } from 'express';
import { supabase } from '@lib/supabase';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';

// Extend Express Request type to include user and full profile
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      userProfile?: any; // Full profile information
    }
  }
}

/**
 * Authentication middleware to protect routes
 * Uses Supabase Auth to validate tokens
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) {
      throw createError(
        'Authentication token is required',
        401,
        'UNAUTHORIZED'
      );
    }

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Invalid Supabase token', { error: error?.message });
      throw createError('Invalid authentication token', 401, 'UNAUTHORIZED');
    }

    // Get user profile from profiles table (including all needed fields)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, email, role, first_name, last_name, is_verified, avatar_url, rating'
      )
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('User profile not found', {
        userId: user.id,
        error: profileError,
      });
      throw createError('User profile not found', 401, 'UNAUTHORIZED');
    }

    // Optional: Check if account is verified when necessary
    // Uncomment if you want this check to be universal
    // if (!profile.is_verified) {
    //   throw createError('Account not verified', 401, 'UNVERIFIED_ACCOUNT');
    // }

    // Attach user to request (minimal info)
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
    };

    // Attach full profile for convenience
    req.userProfile = profile;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('User not authenticated', 401, 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(createError('Access denied', 403, 'FORBIDDEN'));
    }

    next();
  };
};
