/**
 * ZIP Code Coordinate Lookup Service
 * Uses uszips.csv to get accurate lat/lng for US ZIP codes
 */

interface ZipCoordinate {
  zip: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
}

class ZipLookupService {
  private static zipData: Map<string, ZipCoordinate> = new Map();
  private static isLoaded = false;

  /**
   * Load and parse uszips.csv
   */
  static async loadZipData(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // Import the CSV file as text
      const csvText = require('./uszips.csv');
      
      // Parse CSV (skip header row)
      const lines = csvText.trim().split('\n');
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Simple CSV parsing (handles quoted fields)
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 6) continue;
        
        const zip = matches[0].replace(/"/g, '');
        const lat = parseFloat(matches[1].replace(/"/g, ''));
        const lng = parseFloat(matches[2].replace(/"/g, ''));
        const city = matches[3].replace(/"/g, '');
        const state = matches[5].replace(/"/g, '');
        
        if (zip && !isNaN(lat) && !isNaN(lng)) {
          this.zipData.set(zip, { zip, lat, lng, city, state });
        }
      }
      
      this.isLoaded = true;
      console.log(`✅ Loaded ${this.zipData.size} ZIP codes`);
    } catch (error) {
      console.error('Error loading ZIP data:', error);
      throw error;
    }
  }

  /**
   * Get coordinates for a ZIP code
   */
  static getCoordinates(zip: string): ZipCoordinate | null {
    if (!this.isLoaded) {
      console.warn('ZIP data not loaded yet. Call loadZipData() first.');
      return null;
    }

    // Normalize ZIP code (remove spaces, ensure 5 digits)
    const normalizedZip = zip.replace(/\s/g, '').padStart(5, '0');
    return this.zipData.get(normalizedZip) || null;
  }

  /**
   * Check if ZIP code exists in database
   */
  static hasZip(zip: string): boolean {
    const normalizedZip = zip.replace(/\s/g, '').padStart(5, '0');
    return this.zipData.has(normalizedZip);
  }

  /**
   * Get city and state for a ZIP code
   */
  static getCityState(zip: string): { city: string; state: string } | null {
    const coord = this.getCoordinates(zip);
    if (!coord) return null;
    return { city: coord.city, state: coord.state };
  }
}

export { ZipLookupService, ZipCoordinate };
