import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { createClient } from '@supabase/supabase-js';

type ApiShipmentUpdate = {
  // Common allowed fields
  title?: string;
  description?: string;
  pickup_address?: string;
  pickup_city?: string; 
  pickup_state?: string;
  pickup_zip?: string;
  pickup_notes?: string;
  pickup_date?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_zip?: string;
  delivery_notes?: string;
  delivery_date?: string;
  vehicle_type?: string;
  cargo_type?: string;
  weight?: number;
  dimensions?: any;
  estimated_price?: number;
  final_price?: number;
  is_accident_recovery?: boolean;
  distance?: number;
  payment_status?: string;
  
  // Vehicle-related fields
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string | number;
  is_operable?: boolean;
  
  // Payment-related fields
  payment_intent_id?: string;
  terms_accepted?: boolean;
  status?: string;
  
  // Special fields that need to be handled in a custom way
  vehicle_photos?: string[];
  ownership_documents?: string[];
  special_instructions?: string;
  
  // System fields that are always included
  updated_at?: string;
  updated_by?: string;
};

/**
 * ShipmentApiService
 * This service handles shipment-related API calls (vs direct Supabase operations)
 */
export class ShipmentApiService {
  /**
   * Updates a shipment via REST API call
   * Used for updates that might need special handling on the backend
   * 
   * @param shipmentId The ID of the shipment to update
   * @param updateData The data to update
   * @param accessToken Auth token for the request
   * @returns The updated shipment data
   */
  static async updateShipment(
    shipmentId: string,
    updateData: ApiShipmentUpdate,
    accessToken: string
  ): Promise<any> {
    try {
      console.log(`ShipmentApiService: Updating shipment ${shipmentId}`);
      
      // Validate required fields
      if (!shipmentId) {
        throw new Error('Invalid shipment ID');
      }
      
      if (!accessToken) {
        throw new Error('Authorization token is required');
      }

      // Log update attempt
      console.log('Updating shipment with data:', updateData);
      
      // Use environment-specific API URL
      const apiUrl = this.getApiUrl();
      console.log(`Using API URL: ${apiUrl}`);
      
      // Make the API call
      const response = await fetch(`${apiUrl}/api/v1/shipments/${shipmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updateData),
      });
      
      // Check for errors
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error updating shipment:', errorData);
        throw new Error(errorData.message || `Failed to update shipment: ${response.status}`);
      }
      
      // Parse and return the response
      const result = await response.json();
      console.log('Shipment updated successfully:', result);
      
      return result.data;
    } catch (error) {
      console.error('ShipmentApiService.updateShipment error:', error);
      throw error;
    }
  }
  
  /**
   * Gets the appropriate API URL based on the environment
   */
  private static getApiUrl(): string {
    const supabaseUrl = supabase.supabaseUrl;
    
    // Railway API URL
    if (process.env.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL;
    }
    
    // Local development fallback
    return 'http://localhost:3000';
  }
}