import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface FetchOptions extends RequestInit {
  authenticated?: boolean;
}

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for making API requests
 */
export function useFetch<T = any>(
  url: string,
  options: FetchOptions = {}
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Add authentication header if requested and session exists
      if (options.authenticated && session?.access_token) {
        if (!options.headers) {
          options.headers = {};
        }
        
        // Add as object to avoid TypeScript errors with Headers
        options.headers = {
          ...options.headers as object,
          Authorization: `Bearer ${session.access_token}`,
        };
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [url]);

  const refetch = async () => {
    await fetchData();
  };

  return { data, loading, error, refetch };
}
