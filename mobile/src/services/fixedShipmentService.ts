/**
 * ShipmentService
 * This service handles all shipment-related operations
 */
import { supabase } from '../lib/supabase';
import { BookingFormData } from '../context/BookingContext';
import { Database } from '../lib/database.types';

// Define type aliases for better code readability
type ShipmentRow = Database['public']['Tables']['shipments']['Row'];
type ShipmentInsert = Database['public']['Tables']['shipments']['Insert'];
type JobApplicationRow = Database['public']['Tables']['job_applications']['Row'];
type RPCResponse = { message?: string; success?: boolean; [key: string]: any };

/**
 * Interface for creating a new shipment
 * Note: client_id is NOT included here as it should always be derived from 
 * the authenticated user's session for security reasons
 */
export interface CreateShipmentData {
  title: string;
  description?: string;
  pickup_address: string;
  pickup_notes?: string;
  delivery_address: string;
  delivery_notes?: string;
  weight_kg?: number;
  dimensions_cm?: {
    length: number;
    width: number;
    height: number;
  };
  item_value?: number;
  is_fragile?: boolean;
  estimated_distance_km?: number;
  estimated_price: number;
  status?: string; // Optionally allow status to be set
}

export class ShipmentService {
  /**
   * Create a new shipment in Supabase
   */
  static async createShipment(data: CreateShipmentData, userId: string) {
    try {
      console.log('ShipmentService.createShipment - Starting with userId:', userId);
      console.log('ShipmentService.createShipment - Complete payload:', JSON.stringify(data));
      
      // Verify auth state before insert
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) {
        console.error('Authentication error before shipment insert:', authError);
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      
      console.log('Current auth session:', JSON.stringify(authData));
      if (!authData.session) {
        throw new Error('No active session found - user must be logged in to create shipments');
      }
      
      console.log(`Session user ID: ${authData.session.user.id}, Using client_id: ${userId}`);
      if (authData.session.user.id !== userId) {
        console.warn('Warning: Session user ID does not match provided userId');
      }
      
      // Create insert payload with client_id explicitly set to the session user's ID
      const insertPayload: ShipmentInsert = {
        client_id: authData.session.user.id, // Always use the authenticated user's ID
        status: 'pending',
        title: data.title,
        description: data.description,
        pickup_address: data.pickup_address,
        pickup_notes: data.pickup_notes,
        delivery_address: data.delivery_address,
        delivery_notes: data.delivery_notes,
        weight_kg: data.weight_kg,
        dimensions_cm: data.dimensions_cm,
        item_value: data.item_value,
        is_fragile: data.is_fragile || false,
        estimated_distance_km: data.estimated_distance_km,
        estimated_price: data.estimated_price,
        // These fields are required but need to be cast to any because they're not in our insert type
        pickup_location: {} as any,
        delivery_location: {} as any
      };
      console.log('Insert payload:', JSON.stringify(insertPayload));
      
      // Perform the insert with the verified payload
      const { data: shipment, error } = (supabase as any)
        .from('shipments')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('Error creating shipment in Supabase:', error);
        // Attempt to diagnose RLS issues
        if (error.code === '42501') {
          console.error('Row-level security policy violation - this is likely a permission issue:');
          console.error('1. Verify the user is authenticated');
          console.error('2. Verify the RLS policy allows insert where client_id = auth.uid()');
          console.error('3. Verify auth.uid() matches the client_id being inserted:', insertPayload.client_id);
        }
        throw error;
      }

      console.log('Shipment created successfully:', shipment);
      return shipment;
    } catch (error) {
      console.error('ShipmentService.createShipment error:', error);
      throw error;
    }
  }

  /**
   * Convert BookingFormData to CreateShipmentData
   */
  static convertBookingToShipment(bookingData: BookingFormData, estimatedPrice: number = 250): CreateShipmentData {
    const {
      customerDetails,
      vehicleInformation,
      pickupDetails,
      deliveryDetails,
      towingTransport,
    } = bookingData;

    // Create a descriptive title and description
    const vehicleDescription = `${vehicleInformation.year || ''} ${vehicleInformation.make || ''} ${vehicleInformation.model || ''}`.trim();
    const title = vehicleDescription || 'Vehicle Transport';
    
    const description = [
      vehicleDescription && `Vehicle: ${vehicleDescription}`,
      vehicleInformation.vin && `VIN: ${vehicleInformation.vin}`,
      vehicleInformation.licensePlate && `License: ${vehicleInformation.licensePlate}`,
      vehicleInformation.conditionNotes && `Condition: ${vehicleInformation.conditionNotes}`,
      towingTransport.operability && `Operability: ${towingTransport.operability}`,
      deliveryDetails.specialInstructions && `Instructions: ${deliveryDetails.specialInstructions}`,
    ].filter(Boolean).join('\n');

    // Combine pickup and delivery notes
    const pickupNotes = [
      pickupDetails.date && `Pickup Date: ${pickupDetails.date}`,
      pickupDetails.time && `Pickup Time: ${pickupDetails.time}`,
      pickupDetails.contactPerson && `Contact: ${pickupDetails.contactPerson}`,
      pickupDetails.contactPhone && `Phone: ${pickupDetails.contactPhone}`,
    ].filter(Boolean).join('\n');

    const deliveryNotes = [
      deliveryDetails.date && `Delivery Date: ${deliveryDetails.date}`,
      deliveryDetails.time && `Delivery Time: ${deliveryDetails.time}`,
      deliveryDetails.contactPerson && `Contact: ${deliveryDetails.contactPerson}`,
      deliveryDetails.contactPhone && `Phone: ${deliveryDetails.contactPhone}`,
      deliveryDetails.specialInstructions && `Instructions: ${deliveryDetails.specialInstructions}`,
    ].filter(Boolean).join('\n');

    return {
      title,
      description: description || undefined,
      pickup_address: pickupDetails.address || '',
      pickup_notes: pickupNotes || undefined,
      delivery_address: deliveryDetails.address || '',
      delivery_notes: deliveryNotes || undefined,
      estimated_price: estimatedPrice,
      is_fragile: towingTransport.equipmentNeeds?.includes('fragile') || false,
    };
  }

  /**
   * Get shipments for a specific client
   */
  static async getClientShipments(clientId: string, status?: string[]) {
    try {
      let query = supabase
        .from('shipments')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (status && status.length > 0) {
        query = query.in('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching client shipments:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('ShipmentService.getClientShipments error:', error);
      throw error;
    }
  }

  /**
   * Get available shipments for drivers
   * @param driverId Optional driver ID to filter out jobs they've already applied for
   */
  static async getAvailableShipments(driverId?: string) {
    try {
      console.log('Fetching available shipments...');
      
      // Get all pending shipments without a driver assigned
      const { data: pendingShipments, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching available shipments:', error);
        throw error;
      }

      // If no driver ID provided, return all pending shipments
      if (!driverId) {
        console.log(`Found ${pendingShipments?.length || 0} available shipments`);
        return pendingShipments || [];
      }
      
      // If driver ID provided, filter out shipments they've already applied for
      console.log(`Checking applications for driver ${driverId}`);
      const { data: driverApplications, error: appsError } = await supabase
        .from('job_applications')
        .select('shipment_id')
        .eq('driver_id', driverId);
        
      if (appsError) {
        console.error('Error fetching driver applications:', appsError);
        // Continue with all shipments if we can't get applications
        return pendingShipments || [];
      }
      
      // Create a set of shipment IDs the driver has already applied for
      const appliedShipmentIds = new Set(driverApplications?.map((app: any) => app.shipment_id as string) || []);
      
      // Filter out shipments the driver has already applied for
      const availableShipments = pendingShipments?.filter(
        (shipment: any) => !appliedShipmentIds.has(shipment.id as string)
      ) || [];
      
      console.log(`Found ${availableShipments.length} available shipments after filtering out ${appliedShipmentIds.size} applied jobs`);
      
      // Debug: also check all shipments to see their current state
      const { data: allShipments, error: allError } = await supabase
        .from('shipments')
        .select('id, status, driver_id, title')
        .order('created_at', { ascending: false });
        
      if (!allError && allShipments) {
        console.log('DEBUG - All shipments state:', allShipments.map((s: any) => ({
          id: s.id,
          status: s.status,
          driver_id: s.driver_id ? 'assigned' : 'unassigned',
          title: s.title
        })));
      }

      return availableShipments;
    } catch (error) {
      console.error('ShipmentService.getAvailableShipments error:', error);
      throw error;
    }
  }

  /**
   * Apply for a shipment (driver action) - creates job application only, does not assign
   */
  static async applyForShipment(shipmentId: string, driverId: string) {
    try {
      // Validate inputs
      if (!shipmentId || shipmentId === 'null' || shipmentId === 'undefined') {
        throw new Error('Invalid shipment ID provided');
      }
      
      if (!driverId || driverId === 'null' || driverId === 'undefined') {
        throw new Error('Invalid driver ID provided');
      }

      console.log('ShipmentService: Applying for shipment:', { shipmentId, driverId });

      // Use the stored procedure for safer application handling
      const { data: result, error: applicationError } = await supabase
        .rpc('apply_for_shipment', {
          p_shipment_id: shipmentId,
          p_driver_id: driverId
        } as any);

      if (applicationError) {
        console.error('Error applying for shipment:', applicationError);
        throw applicationError;
      }

      console.log('ShipmentService: Application result:', result);
      
      // Handle result
      const typedResult = result as RPCResponse;
      if (typedResult.message && typedResult.message.includes('already applied')) {
        console.log(`ShipmentService: Driver ${driverId} has already applied for shipment ${shipmentId}`);
      } else {
        console.log('ShipmentService: Application submitted successfully');
      }
      
      return typedResult;
    } catch (error) {
      console.error('ShipmentService.applyForShipment error:', error);
      throw error;
    }
  }

  /**
   * Assign a driver to a shipment (admin action)
   */
  static async assignDriverToShipment(shipmentId: string, driverId: string) {
    try {
      // Validate inputs
      if (!shipmentId || shipmentId === 'null' || shipmentId === 'undefined') {
        throw new Error('Invalid shipment ID provided');
      }
      
      if (!driverId || driverId === 'null' || driverId === 'undefined') {
        throw new Error('Invalid driver ID provided');
      }

      console.log('Assigning driver to shipment:', { shipmentId, driverId });

      // Check if shipment exists and is still available
      const { data: shipment, error: checkError } = await supabase
        .from('shipments')
        .select('driver_id, status')
        .eq('id', shipmentId)
        .single();

      if (checkError) {
        console.error('Error checking shipment:', checkError);
        throw checkError;
      }

      if (!shipment) {
        throw new Error('Shipment not found');
      }

      console.log('Current shipment state:', shipment);

      const shipmentData = shipment as any;
      if (shipmentData.driver_id && shipmentData.driver_id !== null) {
        throw new Error('This shipment has already been assigned to a driver');
      }

      if (shipmentData.status !== 'pending') {
        console.warn('Shipment status is not pending:', shipmentData.status);
        throw new Error(`This shipment cannot be assigned. Current status: ${shipmentData.status}`);
      }

      // Use the new stored procedure to handle all the assignment logic
      console.log('Using assign_driver_to_shipment stored procedure...');
      const { data: result, error: assignError } = await supabase
        .rpc('assign_driver_to_shipment', {
          p_shipment_id: shipmentId,
          p_driver_id: driverId
        } as any);

      if (assignError) {
        console.error('Error assigning driver via stored procedure:', assignError);
        throw assignError;
      }

      // Fetch the updated shipment to return
      const { data: updatedShipment, error: fetchError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching updated shipment:', fetchError);
        throw fetchError;
      }

      console.log('Driver assigned successfully:', updatedShipment);
      return updatedShipment;
    } catch (error) {
      console.error('ShipmentService.assignDriverToShipment error:', error);
      throw error;
    }
  }

  /**
   * Get drivers who have applied for a specific shipment
   */
  static async getShipmentApplicants(shipmentId: string) {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          profiles:driver_id (
            id,
            first_name,
            last_name,
            email,
            phone,
            profile_picture_url
          )
        `)
        .eq('shipment_id', shipmentId)
        .eq('status', 'pending')
        .order('applied_at', { ascending: true });

      if (error) {
        console.error('Error fetching shipment applicants:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('ShipmentService.getShipmentApplicants error:', error);
      throw error;
    }
  }

  /**
   * Debug function to check shipment state and potentially reset it
   */
  static async debugShipmentState(shipmentId: string) {
    try {
      const { data: shipment, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();

      if (error) {
        console.error('Error fetching shipment for debug:', error);
        throw error;
      }

      console.log('DEBUG - Current shipment state:', {
        id: (shipment as any).id,
        status: (shipment as any).status,
        driver_id: (shipment as any).driver_id,
        client_id: (shipment as any).client_id,
        title: (shipment as any).title,
        created_at: (shipment as any).created_at,
        updated_at: (shipment as any).updated_at
      });

      return shipment;
    } catch (error) {
      console.error('ShipmentService.debugShipmentState error:', error);
      throw error;
    }
  }

  /**
   * Reset a shipment back to pending status (admin function for debugging)
   */
  static async resetShipmentToPending(shipmentId: string) {
    try {
      console.log('Resetting shipment to pending status:', shipmentId);

      const { data: updatedShipment, error } = (supabase as any)
        .from('shipments')
        .update({
          driver_id: null,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipmentId)
        .select()
        .single();

      if (error) {
        console.error('Error resetting shipment:', error);
        throw error;
      }

      // Also reset any job applications
      const { error: resetApplicationsError } = (supabase as any)
        .from('job_applications')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('shipment_id', shipmentId);

      if (resetApplicationsError) {
        console.error('Error resetting job applications:', resetApplicationsError);
      }

      console.log('Shipment reset successfully:', updatedShipment);
      return updatedShipment;
    } catch (error) {
      console.error('ShipmentService.resetShipmentToPending error:', error);
      throw error;
    }
  }

  /**
   * Get all available drivers in the system
   */
  static async getAllAvailableDrivers() {
    try {
      const { data: drivers, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver');

      if (error) {
        console.error('Error fetching available drivers:', error);
        return [];
      }

      return drivers || [];
    } catch (error) {
      console.error('ShipmentService.getAllAvailableDrivers error:', error);
      return [];
    }
  }
  
  // Note: Payment status updates have been moved to PaymentStatusService
}