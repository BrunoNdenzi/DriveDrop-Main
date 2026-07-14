/**
 * Authentication routes
 */
import { Router } from 'express';
import { login, register, refreshToken, logout } from '@controllers/auth.controller';
import { sendPhoneOtp, verifyPhoneOtp } from '@controllers/phone-otp.controller';

const router = Router();

// POST /api/v1/auth/login - Login with email and password
router.post('/login', login);

// POST /api/v1/auth/register - Register a new user
router.post('/register', register);

// POST /api/v1/auth/refresh-token - Refresh access token
router.post('/refresh-token', refreshToken);

// POST /api/v1/auth/logout - Logout user
router.post('/logout', logout);

// POST /api/v1/auth/phone/send-otp - Send phone verification code
router.post('/phone/send-otp', sendPhoneOtp);

// POST /api/v1/auth/phone/verify-otp - Verify phone OTP code
router.post('/phone/verify-otp', verifyPhoneOtp);

export default router;
