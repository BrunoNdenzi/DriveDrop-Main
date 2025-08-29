/**
 * User controller
 */
import { Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { userService } from '@services/supabase.service';
import { isValidUuid } from '@utils/validation';
import { UserRole } from '../types/api.types';

/**
 * Get current user profile
 * @route GET /api/v1/users/me
 * @access Private
 */
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const user = await userService.getUserById(req.user.id);

    res.status(200).json(successResponse(user));
  }
);

/**
 * Get user by ID
 * @route GET /api/v1/users/:id
 * @access Private (Admin)
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid user ID format', 400, 'INVALID_ID');
  }

  const user = await userService.getUserById(id);

  res.status(200).json(successResponse(user));
});

/**
 * Get all users (with pagination)
 * @route GET /api/v1/users
 * @access Private (Admin)
 */
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt((req.query['page'] as string) || '1', 10);
  const limit = parseInt((req.query['limit'] as string) || '10', 10);
  const role = req.query['role'] as UserRole | undefined;

  const { data, meta } = await userService.getUsers(page, limit, role);

  res.status(200).json(successResponse(data, meta));
});

/**
 * Update current user profile
 * @route PUT /api/v1/users/me
 * @access Private
 */
export const updateCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { first_name, last_name, phone, avatar_url } = req.body;

    // Validate input
    const updates: any = {};
    if (first_name) updates.first_name = first_name.trim();
    if (last_name) updates.last_name = last_name.trim();
    if (phone) updates.phone = phone.trim();
    if (avatar_url) updates.avatar_url = avatar_url.trim();

    if (Object.keys(updates).length === 0) {
      throw createError('No valid fields to update', 400, 'NO_UPDATES');
    }

    const user = await userService.updateUserProfile(req.user.id, updates);

    res.status(200).json(successResponse(user));
  }
);

/**
 * Update user rating (Admin only)
 * @route PATCH /api/v1/users/:id/rating
 * @access Private (Admin)
 */
export const updateUserRating = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { rating } = req.body;

    if (!id || !isValidUuid(id)) {
      throw createError('Invalid user ID format', 400, 'INVALID_ID');
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      throw createError(
        'Rating must be a number between 1 and 5',
        400,
        'INVALID_RATING'
      );
    }

    const user = await userService.updateUserRating(id, rating);

    res.status(200).json(successResponse(user));
  }
);

/**
 * Get drivers near location (Client only)
 * @route GET /api/v1/users/drivers/nearby
 * @access Private (Client)
 */
export const getDriversNearby = asyncHandler(
  async (req: Request, res: Response) => {
    const lat = parseFloat(req.query['lat'] as string);
    const lng = parseFloat(req.query['lng'] as string);
    const radius = parseInt((req.query['radius'] as string) || '10', 10);

    if (isNaN(lat) || isNaN(lng)) {
      throw createError(
        'Valid latitude and longitude are required',
        400,
        'INVALID_COORDINATES'
      );
    }

    if (!req.user?.id) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Only clients can search for nearby drivers
    if (req.user.role !== 'client') {
      throw createError(
        'Only clients can search for nearby drivers',
        403,
        'FORBIDDEN'
      );
    }

    const drivers = await userService.getDriversNearLocation(lat, lng, radius);

    res.status(200).json(successResponse(drivers));
  }
);
