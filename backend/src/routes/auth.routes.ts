/**
 * Authentication routes
 */
import { Router } from 'express';
import {
  login,
  register,
  refreshToken,
  logout,
} from '@controllers/auth.controller';

const router = Router();

// POST /api/v1/auth/login - Login with email and password
router.post('/login', login);

// POST /api/v1/auth/register - Register a new user
router.post('/register', register);

// POST /api/v1/auth/refresh-token - Refresh access token
router.post('/refresh-token', refreshToken);

// POST /api/v1/auth/logout - Logout user
router.post('/logout', logout);

export default router;
