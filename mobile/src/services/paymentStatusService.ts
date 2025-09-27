/**
 * Payment Status Service
 * Handles payment status updates for shipments
 */
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type ShipmentUpdate = Database['public']['Tables']['shipments']['Update'];
type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export class PaymentStatusService {
  /**
   * Updates the payment status for a shipment
   */
  static async updatePaymentStatus(shipmentId: string, status: PaymentStatus): Promise<any> {
    try {
      console.log(`PaymentStatusService: Updating payment status for shipment ${shipmentId} to ${status}`);
      
      // Validate input
      if (!shipmentId) {
        throw new Error('Invalid shipment ID');
      }
      
      // Validate status
      const validStatuses: PaymentStatus[] = ['pending', 'processing', 'completed', 'failed', 'refunded'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid payment status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Define update data
      const updateData: ShipmentUpdate = {
        payment_status: status,
        updated_at: new Date().toISOString()
      };

      // Update the shipment
      const { data, error } = await supabase
        .from('shipments')
        .update(updateData)
        .eq('id', shipmentId)
        .select();

      if (error) {
        console.error('Error updating payment status:', error);
        throw error;
      }

      console.log('Payment status updated successfully:', data);
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('PaymentStatusService.updatePaymentStatus error:', error);
      throw error;
    }
  }
}