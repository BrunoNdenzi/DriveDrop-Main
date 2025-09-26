/**
 * Enhanced Address Utilities for US Addresses
 * Provides comprehensive address parsing, validation, and ZIP code lookup functionality
 */

export interface AddressComponents {
  streetNumber?: string;
  streetName?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  zipCode?: string;
  county?: string;
  country?: string;
  formattedAddress?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface ZipCodeInfo {
  zipCode: string;
  city: string;
  state: string;
  stateCode: string;
  county?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

/**
 * Extract address components from Google Places API response
 */
export function extractAddressComponents(placeDetails: any): AddressComponents {
  if (!placeDetails || !placeDetails.address_components) {
    return {};
  }

  const components: AddressComponents = {};
  
  // Extract formatted address and coordinates
  components.formattedAddress = placeDetails.formatted_address;
  if (placeDetails.geometry?.location) {
    components.coordinates = {
      lat: placeDetails.geometry.location.lat,
      lng: placeDetails.geometry.location.lng,
    };
  }

  // Parse address components
  placeDetails.address_components.forEach((component: any) => {
    const types = component.types;

    if (types.includes('street_number')) {
      components.streetNumber = component.long_name;
    } else if (types.includes('route')) {
      components.streetName = component.long_name;
    } else if (types.includes('locality') || types.includes('sublocality')) {
      components.city = component.long_name;
    } else if (types.includes('administrative_area_level_1')) {
      components.state = component.long_name;
      components.stateCode = component.short_name;
    } else if (types.includes('postal_code')) {
      components.zipCode = component.long_name;
    } else if (types.includes('administrative_area_level_2')) {
      components.county = component.long_name;
    } else if (types.includes('country')) {
      components.country = component.long_name;
    }
  });

  return components;
}

/**
 * Validate US ZIP code format
 */
export function validateZipCode(zipCode: string): boolean {
  // Remove any non-numeric characters
  const cleanZip = zipCode.replace(/\D/g, '');
  
  // Check for 5-digit or 9-digit (ZIP+4) format
  return /^\d{5}(\d{4})?$/.test(cleanZip);
}

/**
 * Format ZIP code to standard format
 */
export function formatZipCode(zipCode: string): string {
  const cleanZip = zipCode.replace(/\D/g, '');
  
  if (cleanZip.length === 9) {
    return `${cleanZip.slice(0, 5)}-${cleanZip.slice(5)}`;
  } else if (cleanZip.length === 5) {
    return cleanZip;
  }
  
  return zipCode; // Return original if not valid
}

/**
 * Lookup city and state from ZIP code using Google Geocoding API
 */
export async function lookupZipCode(zipCode: string, apiKey: string): Promise<ZipCodeInfo | null> {
  if (!validateZipCode(zipCode) || !apiKey) {
    return null;
  }

  try {
    const formattedZip = formatZipCode(zipCode);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${formattedZip}&components=country:US&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Geocoding API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn('ZIP code lookup failed:', data.status);
      return null;
    }

    const result = data.results[0];
    const components = extractAddressComponents(result);

    if (!components.city || !components.state) {
      return null;
    }

    return {
      zipCode: formattedZip,
      city: components.city,
      state: components.state,
      stateCode: components.stateCode || '',
      county: components.county,
      coordinates: components.coordinates,
    };
  } catch (error) {
    console.error('Error looking up ZIP code:', error);
    return null;
  }
}

/**
 * Validate complete US address
 */
export function validateUSAddress(address: string): boolean {
  if (!address || address.trim().length < 5) {
    return false;
  }

  // Basic validation - should contain at least a number and some letters
  const hasNumber = /\d/.test(address);
  const hasLetters = /[a-zA-Z]/.test(address);
  
  return hasNumber && hasLetters;
}

/**
 * Format address for display with proper US conventions
 */
export function formatUSAddress(components: AddressComponents): string {
  const parts: string[] = [];

  // Street address
  if (components.streetNumber && components.streetName) {
    parts.push(`${components.streetNumber} ${components.streetName}`);
  } else if (components.streetName) {
    parts.push(components.streetName);
  }

  // City, State ZIP
  if (components.city && components.state) {
    let cityStateZip = `${components.city}, ${components.stateCode || components.state}`;
    if (components.zipCode) {
      cityStateZip += ` ${components.zipCode}`;
    }
    parts.push(cityStateZip);
  } else if (components.city) {
    parts.push(components.city);
  }

  return parts.join(', ');
}

/**
 * Standardize address format for consistent storage
 */
export function standardizeAddress(address: string, components?: AddressComponents): string {
  if (components) {
    return formatUSAddress(components);
  }
  
  // Basic cleanup if no components provided
  return address
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/,\s*,/g, ',') // Remove duplicate commas
    .trim();
}

/**
 * Extract ZIP code from address string
 */
export function extractZipFromAddress(address: string): string | null {
  // Look for 5 or 9 digit ZIP codes at the end of the address
  const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b(?:\s*$|(?=\s*,\s*USA?\s*$))/i);
  return zipMatch ? zipMatch[1] : null;
}

/**
 * Determine if input looks like a ZIP code
 */
export function looksLikeZipCode(input: string): boolean {
  const cleaned = input.replace(/\D/g, '');
  return cleaned.length === 5 || cleaned.length === 9;
}

/**
 * Enhanced address search that handles both full addresses and ZIP codes
 */
export async function searchAddress(
  query: string, 
  apiKey: string,
  includeZipLookup: boolean = true
): Promise<{ 
  predictions: any[], 
  zipInfo?: ZipCodeInfo | null,
  isZipCodeQuery: boolean 
}> {
  const isZipQuery = looksLikeZipCode(query);
  
  // If it looks like a ZIP code and ZIP lookup is enabled
  if (isZipQuery && includeZipLookup) {
    const zipInfo = await lookupZipCode(query, apiKey);
    return {
      predictions: [],
      zipInfo,
      isZipCodeQuery: true
    };
  }

  // Regular address search
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&types=geocode&components=country:us&language=en`
    );

    if (!response.ok) {
      throw new Error(`Places API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.warn('Places API error:', data.status);
      return { predictions: [], isZipCodeQuery: false };
    }

    return {
      predictions: data.predictions || [],
      isZipCodeQuery: false
    };
  } catch (error) {
    console.error('Error searching addresses:', error);
    return { predictions: [], isZipCodeQuery: false };
  }
}