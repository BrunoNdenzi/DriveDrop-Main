import { Alert } from 'react-native';
// import { Platform } from 'react-native'; // TODO: May be needed for platform-specific networking logic
import NetInfo from '@react-native-community/netinfo';

/**
 * A utility class for handling network-related operations and errors
 */
class NetworkUtil {
  /**
   * Check if the device has an active internet connection
   */
  static async isConnected(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true;
  }

  /**
   * Wrapper function to execute a network request with error handling
   * @param requestFn - The async function that performs the network request
   * @param errorMessage - Custom error message to show on failure
   * @param silent - If true, doesn't show error alerts
   */
  static async executeRequest<T>(
    requestFn: () => Promise<T>,
    errorMessage = 'Network request failed. Please check your connection and try again.',
    silent = false
  ): Promise<{ data: T | null; error: any }> {
    try {
      // Check connectivity first
      const isConnected = await this.isConnected();
      if (!isConnected) {
        if (!silent) {
          Alert.alert(
            'No Internet Connection',
            'Please check your internet connection and try again.'
          );
        }
        return { data: null, error: new Error('No internet connection') };
      }

      // Execute the request
      const data = await requestFn();
      return { data, error: null };
    } catch (error: any) {
      console.error('Network request failed:', error);

      // Handle different types of errors
      if (!silent) {
        if (error.message === 'Network request failed') {
          Alert.alert('Connection Error', errorMessage);
        } else if (error.status === 401 || error.code === 'PGRST301') {
          Alert.alert(
            'Authentication Error',
            'Your session has expired. Please log in again.'
          );
        } else if (error.code && error.message) {
          Alert.alert('Error', `${error.message} (${error.code})`);
        } else {
          Alert.alert('Error', errorMessage);
        }
      }

      return { data: null, error };
    }
  }

  /**
   * Retry a function with exponential backoff
   * @param fn - Function to retry
   * @param maxRetries - Maximum number of retries
   * @param baseDelay - Base delay in milliseconds
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        // Wait with exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, baseDelay * Math.pow(2, i))
        );
      }
    }

    throw lastError;
  }
}

export default NetworkUtil;
