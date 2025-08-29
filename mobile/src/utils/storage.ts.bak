import * as SecureStore from 'expo-secure-store';

const PREFIX = 'drivedrop:';

/**
 * Utility functions for securely storing sensitive data
 */
export const secureStorage = {
  /**
   * Store a value securely
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(`${PREFIX}${key}`, value);
    } catch (error) {
      console.error('Error storing secure item', error);
    }
  },

  /**
   * Get a securely stored value
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = await SecureStore.getItemAsync(`${PREFIX}${key}`);
      return value;
    } catch (error) {
      console.error('Error retrieving secure item', error);
      return null;
    }
  },

  /**
   * Delete a securely stored value
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(`${PREFIX}${key}`);
    } catch (error) {
      console.error('Error deleting secure item', error);
    }
  },

  /**
   * Check if a key exists in secure storage
   */
  hasKey: async (key: string): Promise<boolean> => {
    const value = await secureStorage.getItem(key);
    return value !== null;
  },

  /**
   * Store an object securely by stringifying it
   */
  setObject: async <T extends object>(key: string, value: T): Promise<void> => {
    try {
      const jsonValue = JSON.stringify(value);
      await SecureStore.setItemAsync(`${PREFIX}${key}`, jsonValue);
    } catch (error) {
      console.error('Error storing secure object', error);
    }
  },

  /**
   * Get an object from secure storage
   */
  getObject: async <T = object>(key: string): Promise<T | null> => {
    try {
      const jsonValue = await SecureStore.getItemAsync(`${PREFIX}${key}`);
      return jsonValue != null ? (JSON.parse(jsonValue) as T) : null;
    } catch (error) {
      console.error('Error retrieving secure object', error);
      return null;
    }
  },
};
