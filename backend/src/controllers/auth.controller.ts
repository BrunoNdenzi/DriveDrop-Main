/**
 * Authentication controller
 */
import { Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { authService } from '@services/auth.service';
import { isValidEmail, isValidPassword } from '@utils/validation';
import { UserRole } from '../types/api.types';

/**
 * Login with email and password
 * @route POST /api/v1/auth/login
 * @access Public
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw createError('Email and password are required', 400, 'MISSING_FIELDS');
  }

  // Validate email format
  if (!isValidEmail(email)) {
    throw createError('Invalid email format', 400, 'INVALID_EMAIL');
  }

  // Login user
  const { accessToken, refreshToken } = await authService.login(email, password);

  // Set refresh token as HTTP-only cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Return access token
  res.status(200).json(successResponse({ accessToken }));
});

/**
 * Register a new user
 * @route POST /api/v1/auth/register
 * @access Public
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, role, phone } = req.body;

  // Validate required fields
  if (!email || !password || !firstName || !lastName) {
    throw createError('Missing required fields', 400, 'MISSING_FIELDS');
  }

  // Validate email format
  if (!isValidEmail(email)) {
    throw createError('Invalid email format', 400, 'INVALID_EMAIL');
  }

  // Validate password strength
  if (!isValidPassword(password)) {
    throw createError(
      'Password must be at least 8 characters and include uppercase, lowercase, and numbers',
      400,
      'WEAK_PASSWORD'
    );
  }

  // Validate role
  if (role && !Object.values(UserRole).includes(role as UserRole)) {
    throw createError('Invalid role', 400, 'INVALID_ROLE');
  }

  // Default to client role if not specified
  const userRole = role as UserRole || UserRole.CLIENT;

  // Register user
  const { accessToken, refreshToken } = await authService.register(
    email,
    password,
    firstName,
    lastName,
    userRole,
    phone
  );

  // Set refresh token as HTTP-only cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Return access token
  res.status(201).json(successResponse({ accessToken }));
});

/**
 * Refresh access token
 * @route POST /api/v1/auth/refresh-token
 * @access Public
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw createError('Refresh token is required', 401, 'UNAUTHORIZED');
  }

  const { accessToken } = await authService.refreshToken(refreshToken);

  res.status(200).json(successResponse({ accessToken }));
});

/**
 * Logout user
 * @route POST /api/v1/auth/logout
 * @access Public
 */
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  // Clear refresh token cookie
  res.clearCookie('refreshToken');

  res.status(200).json(successResponse({ message: 'Logged out successfully' }));
});
