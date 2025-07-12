import { supabase } from '../lib/supabase';
import { BookingFormData } from '../context/BookingContext';

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
}

export class ShipmentService {
  /**
   * Create a new shipment in Supabase
   */
  static async createShipment(data: CreateShipmentData, userId: string) {
    try {
      console.log('Creating shipment with data:', data);
      
      const { data: shipment, error } = await supabase
        .from('shipments')
        .insert([
          {
            client_id: userId,
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
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating shipment:', error);
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
   */
  static async getAvailableShipments() {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching available shipments:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('ShipmentService.getAvailableShipments error:', error);
      throw error;
    }
  }

  /**
   * Apply for a shipment (driver action) - assigns driver directly to shipment
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

      console.log('Applying for shipment:', { shipmentId, driverId });

      // Check if driver has already applied for this shipment
      const { data: existingApplication, error: applicationCheckError } = await supabase
        .from('job_applications')
        .select('id, status')
        .eq('shipment_id', shipmentId)
        .eq('driver_id', driverId)
        .maybeSingle();

      if (applicationCheckError) {
        console.error('Error checking existing application:', applicationCheckError);
        throw applicationCheckError;
      }

      if (existingApplication) {
        throw new Error('You have already applied for this shipment');
      }

      // Check if shipment is still available (no driver assigned)
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

      if (shipment.driver_id && shipment.driver_id !== null) {
        throw new Error('This shipment has already been assigned to another driver');
      }

      if (shipment.status !== 'pending') {
        throw new Error('This shipment is no longer available');
      }

      // Create job application first
      const { error: applicationError } = await supabase
        .from('job_applications')
        .insert({
          shipment_id: shipmentId,
          driver_id: driverId,
          status: 'applied',
          applied_at: new Date().toISOString(),
        });

      if (applicationError) {
        console.error('Error creating job application:', applicationError);
        throw applicationError;
      }

      // Assign driver to shipment and update status
      const { data, error } = await supabase
        .from('shipments')
        .update({ 
          driver_id: driverId,
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipmentId)
        .is('driver_id', null) // Ensure it's still unassigned
        .select()
        .single();

      if (error) {
        console.error('Error applying for shipment:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Shipment was assigned to another driver just now. Please try another shipment.');
      }

      return data;
    } catch (error) {
      console.error('ShipmentService.applyForShipment error:', error);
      throw error;
    }
  }

}
