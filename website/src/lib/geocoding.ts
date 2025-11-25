/**
 * Geocoding utility functions for converting addresses to coordinates
 */

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address?: string;
}

interface GeocodeError {
  error: string;
}

/**
 * Geocode an address to get lat/lng coordinates
 * @param address - The address string to geocode
 * @returns Promise with coordinates or throws error
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const response = await fetch('/api/geocode', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Geocoding failed');
  }

  return data;
}

/**
 * Geocode multiple addresses in batch
 * @param addresses - Array of address strings
 * @returns Promise with array of results (may include null for failed geocoding)
 */
export async function geocodeAddresses(
  addresses: string[]
): Promise<(GeocodeResult | null)[]> {
  const results = await Promise.allSettled(
    addresses.map(address => geocodeAddress(address))
  );

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    console.error('Geocoding failed:', result.reason);
    return null;
  });
}

/**
 * Create PostGIS POINT string from coordinates
 * @param lng - Longitude
 * @param lat - Latitude
 * @returns PostGIS POINT string
 */
export function createPostGISPoint(lng: number, lat: number): string {
  return `POINT(${lng} ${lat})`;
}

/**
 * Geocode address and return PostGIS POINT string
 * @param address - The address to geocode
 * @returns PostGIS POINT string or null if geocoding fails
 */
export async function geocodeToPostGIS(
  address: string
): Promise<string | null> {
  try {
    const result = await geocodeAddress(address);
    return createPostGISPoint(result.lng, result.lat);
  } catch (error) {
    console.error('Failed to geocode address:', address, error);
    return null;
  }
}
