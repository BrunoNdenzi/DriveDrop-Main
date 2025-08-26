import { Alert } from 'react-native';
import { supabase } from '../supabase';
import NetworkUtil from './NetworkUtil';

/**
 * Valid shipment statuses based on database schema
 * These must match the values in the shipment_status enum in the database
 */
export const VALID_SHIPMENT_STATUSES = [
  'pending', // Initial status when created
  'accepted', // Accepted but not yet assigned to a driver
  'assigned', // Assigned to a driver
  'in_transit', // Driver has picked up and is delivering
  'in_progress', // Alternative name for in_transit
  'delivered', // Successfully delivered to destination
  'completed', // All requirements fulfilled including payment
  'cancelled', // Cancelled by client, driver, or admin
];

/**
 * Utility functions for handling shipment status updates
 */
export const ShipmentUtil = {
  /**
   * Update a shipment's status safely, with validation
   *
   * @param shipmentId - The ID of the shipment to update
   * @param newStatus - The new status value
   * @param onSuccess - Callback function called on successful update
   * @returns Object containing success status and error (if any)
   */
  async updateShipmentStatus(
    shipmentId: string,
    newStatus: string,
    onSuccess?: () => void
  ) {
    try {
      // Ensure we have network connectivity
      const isConnected = await NetworkUtil.isConnected();
      if (!isConnected) {
        Alert.alert(
          'No Internet Connection',
          'Please check your internet connection and try again.'
        );
        return { success: false, error: 'No internet connection' };
      }

      // Validate the status is valid according to the schema
      if (!VALID_SHIPMENT_STATUSES.includes(newStatus)) {
        Alert.alert(
          'Invalid Status',
          `The status "${newStatus}" is not valid. Please contact support.`
        );
        return { success: false, error: 'Invalid status value' };
      }

      // Update the shipment status
      const { error } = await supabase
        .from('shipments')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipmentId);

      if (error) {
        // Handle enum type validation error
        if (error.message.includes('invalid input value for enum')) {
          Alert.alert(
            'Database Schema Error',
            'The status value is not compatible with the database. Please contact support.'
          );
        } else if (error.code === '42501') {
          // Permission denied
          Alert.alert(
            'Permission Error',
            'You do not have permission to update this shipment.'
          );
        } else {
          Alert.alert('Error', `Failed to update shipment: ${error.message}`);
        }
        return { success: false, error: error.message };
      }

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Success!
      return { success: true, error: null };
    } catch (error) {
      console.error('Error updating shipment status:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred while updating the shipment.'
      );
      return { success: false, error: 'Unexpected error' };
    }
  },

  /**
   * Create a record in the shipment_status_history table
   *
   * @param shipmentId - The ID of the shipment
   * @param status - The new status
   * @param userId - The ID of the user making the change
   * @param notes - Optional notes about the status change
   */
  async recordStatusChange(
    shipmentId: string,
    status: string,
    userId: string,
    notes?: string,
    location?: { lat: number; lng: number }
  ) {
    try {
      const { error } = await supabase.from('shipment_status_history').insert({
        shipment_id: shipmentId,
        status,
        changed_by: userId,
        notes: notes || null,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        changed_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error recording status change:', error);
      }
    } catch (error) {
      console.error('Error recording status change:', error);
    }
  },
};
