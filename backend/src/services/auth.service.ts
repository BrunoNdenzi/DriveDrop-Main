/**
 * Authentication service
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from '@lib/supabase';
import config from '@config/index';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';
import { UserRole } from '../types/api.types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication service for user login, registration, etc.
 */
export const authService = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    try {
      // Get user from Supabase
      const { data: user, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !user) {
        throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.user.id)
        .single();

      if (profileError || !profile) {
        throw createError('User profile not found', 404, 'USER_NOT_FOUND');
      }

      // Generate JWT tokens - using a simpler approach
      const accessToken = jwt.sign(
        { id: user.user.id },
        config.auth.jwtSecret,
        { expiresIn: '1d' } // Hardcoded for now
      );
      
      const refreshToken = jwt.sign(
        { id: user.user.id },
        config.auth.jwtSecret,
        { expiresIn: '30d' } // Hardcoded for now
      );

      return { accessToken, refreshToken };
    } catch (error) {
      logger.error('Login error', { error, email });
      throw error;
    }
  },

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: UserRole,
    phone?: string,
  ): Promise<AuthTokens> {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        throw createError('User already exists', 409, 'USER_EXISTS');
      }

      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role,
            phone,
          },
        },
      });

      if (error || !data.user) {
        throw createError(error?.message || 'Registration failed', 400, 'REGISTRATION_FAILED');
      }

      // Create profile entry in the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          first_name: firstName,
          last_name: lastName,
          email: email,
          role: role,
          phone: phone || null,
          avatar_url: null,
          is_verified: false,
          rating: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        logger.error('Profile creation error', { error: profileError, userId: data.user.id });
        // If profile creation fails, we should clean up the auth user
        // But for now, we'll just log the error and continue
        throw createError('Database error creating user profile', 500, 'PROFILE_CREATION_FAILED');
      }

      // Generate JWT tokens - using a simpler approach
      const accessToken = jwt.sign(
        { id: data.user.id },
        config.auth.jwtSecret,
        { expiresIn: '1d' } // Hardcoded for now
      );
      
      const refreshToken = jwt.sign(
        { id: data.user.id },
        config.auth.jwtSecret,
        { expiresIn: '30d' } // Hardcoded for now
      );

      return { accessToken, refreshToken };
    } catch (error) {
      logger.error('Registration error', { error, email });
      throw error;
    }
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.auth.jwtSecret) as { id: string };

      // Check if user exists
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', decoded.id)
        .single();

      if (error || !data) {
        throw createError('Invalid refresh token', 401, 'INVALID_TOKEN');
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { id: decoded.id },
        config.auth.jwtSecret,
        { expiresIn: '1d' } // Hardcoded for now
      );

      return { accessToken };
    } catch (error) {
      logger.error('Refresh token error', { error });
      throw error instanceof jwt.JsonWebTokenError
        ? createError('Invalid refresh token', 401, 'INVALID_TOKEN')
        : error;
    }
  },

  /**
   * Validate password
   */
  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  },
};
