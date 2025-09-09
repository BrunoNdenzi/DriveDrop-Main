// Type assertion helper file

/**
 * A helper function to assert the type of an object
 * @param value The value to assert
 * @returns The value with its type properly asserted
 */
export function assertType<T>(value: any): T {
  return value as T;
}
