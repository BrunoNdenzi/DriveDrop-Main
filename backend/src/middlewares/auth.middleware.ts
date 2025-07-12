/**
 * Authentication middleware
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '@config/index';
import { supabase } from '@lib/supabase';
import { createError } from '@utils/error';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Authentication middleware to protect routes
 */
export const authenticate = async (
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

    // Verify token
    const decoded = jwt.verify(token, config.auth.jwtSecret) as { id: string };

    // Get user from Supabase
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', decoded.id)
      .single();

    if (error || !data) {
      throw createError('User not found', 401, 'UNAUTHORIZED');
    }

    // Attach user to request
    req.user = {
      id: data.id,
      email: data.email,
      role: data.role,
    };

    next();
  } catch (error) {
    next(error instanceof jwt.JsonWebTokenError 
      ? createError('Invalid token', 401, 'UNAUTHORIZED')
      : error);
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
