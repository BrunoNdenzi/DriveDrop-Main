/**
 * Authentication service
 */
import { supabase } from '@lib/supabase';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';
import { UserRole } from '../types/api.types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication service for user login, registration, etc.
 * Uses Supabase Auth tokens directly
 */
export const authService = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    try {
      // Get user from Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        throw createError('User profile not found', 404, 'USER_NOT_FOUND');
      }

      // Return Supabase auth tokens directly
      return { 
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      };
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

      // Profile is automatically created by database trigger
      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify profile was created
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        logger.error('Profile not found after registration', { error: profileError, userId: data.user.id });
        throw createError('Profile creation failed', 500, 'PROFILE_CREATION_FAILED');
      }

      // Return Supabase auth tokens directly
      if (!data.session) {
        // If session is not available (e.g., email confirmation required)
        // Sign in the user to get tokens
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError || !signInData.session) {
          throw createError('Registration succeeded but login failed', 400, 'LOGIN_AFTER_REGISTER_FAILED');
        }

        return { 
          accessToken: signInData.session.access_token,
          refreshToken: signInData.session.refresh_token
        };
      }

      return { 
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      };
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
      // Use Supabase's refreshSession method
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        throw createError('Invalid refresh token', 401, 'INVALID_TOKEN');
      }

      return { accessToken: data.session.access_token };
    } catch (error) {
      logger.error('Refresh token error', { error });
      throw createError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }
  },

  /**
   * Validate password - now uses Supabase directly for auth
   * This method is kept for backward compatibility but may not be needed
   */
  async validatePassword(_plainPassword: string, _hashedPassword: string): Promise<boolean> {
    logger.warn('validatePassword was called directly - this should be avoided');
    return false; // Always return false as we shouldn't be using this method directly
  },
};
