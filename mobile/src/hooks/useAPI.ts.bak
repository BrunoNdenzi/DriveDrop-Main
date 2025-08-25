import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import { auth } from '../lib/supabase';

// Get API URL from constants
const API_URL = Constants.expoConfig?.extra?.apiUrl as string;

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function useAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch data from API with authentication
   */
  const fetchWithAuth = useCallback(
    async <T = any>(
      endpoint: string,
      options: RequestInit = {}
    ): Promise<APIResponse<T> | null> => {
      try {
        setLoading(true);
        setError(null);

        // Get the user's JWT token
        const {
          data: { session },
        } = await auth.getSession();

        if (!session) {
          throw new Error('No authenticated session found');
        }

        const url = `${API_URL}${endpoint}`;
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          ...options.headers,
        };

        const response = await fetch(url, {
          ...options,
          headers,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'An error occurred while fetching data'
          );
        }

        return data;
      } catch (err: any) {
        setError(err.message || 'An error occurred');
        console.error('API Error:', err);

        if (err.message === 'No authenticated session found') {
          // Handle unauthenticated error - this could redirect to login
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please sign in again.',
            [
              {
                text: 'OK',
                onPress: () => auth.signOut(),
              },
            ]
          );
        }

        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Fetch data from API without authentication
   */
  const fetchWithoutAuth = useCallback(
    async <T = any>(
      endpoint: string,
      options: RequestInit = {}
    ): Promise<APIResponse<T> | null> => {
      try {
        setLoading(true);
        setError(null);

        const url = `${API_URL}${endpoint}`;
        const headers = {
          'Content-Type': 'application/json',
          ...options.headers,
        };

        const response = await fetch(url, {
          ...options,
          headers,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'An error occurred while fetching data'
          );
        }

        return data;
      } catch (err: any) {
        setError(err.message || 'An error occurred');
        console.error('API Error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    fetchWithAuth,
    fetchWithoutAuth,
  };
}
