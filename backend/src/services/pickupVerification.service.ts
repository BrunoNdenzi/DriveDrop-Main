/**
 * Pickup Verification Service
 * Backend service for handling driver pickup verification operations
 */
import { supabaseAdmin as supabase } from '../lib/supabase';
import { createError } from '../utils/error';
import { logger } from '../utils/logger';
import type {
  PickupVerification,
  CancellationRecord,
  StartVerificationRequest,
  SubmitVerificationRequest,
  ClientVerificationResponse,
  CancelShipmentRequest,
  VerificationPhoto,
  PhotoAngle,
} from '../types/pickupVerification';

/**
 * Pickup Verification Service
 */
export class PickupVerificationService {
  /**
   * Mark driver as en route to pickup
   */
  static async markDriverEnRoute(
    shipmentId: string,
    driverId: string,
    _location: { lat: number; lng: number }
  ): Promise<void> {
    try {
      logger.info(`Marking driver ${driverId} en route for shipment ${shipmentId}`);
      
      // Call status update function
      const { error } = await supabase.rpc('update_shipment_status_safe', {
        p_shipment_id: shipmentId,
        p_new_status: 'driver_en_route',
        p_user_id: driverId,
      });
      
      if (error) {
        logger.error('Error marking driver en route:', error);
        throw createError(error.message, 400, 'STATUS_UPDATE_FAILED');
      }
      
      logger.info('Driver marked as en route successfully');
    } catch (error) {
      logger.error('PickupVerificationService.markDriverEnRoute error:', { error });
      throw error;
    }
  }

  /**
   * Mark driver as arrived at pickup location
   * Requires GPS verification within 100 meters
   */
  static async markDriverArrived(
    shipmentId: string,
    driverId: string,
    location: { lat: number; lng: number; accuracy: number }
  ): Promise<void> {
    try {
      logger.info(`Marking driver ${driverId} arrived for shipment ${shipmentId}`);
      
      // Get shipment pickup coordinates using PostGIS
      const { data: shipment, error: shipmentError } = await supabase
        .rpc('get_shipment_coordinates', { shipment_id: shipmentId });
      
      if (shipmentError || !shipment || shipment.length === 0) {
        logger.warn(`Shipment ${shipmentId} not found or has no pickup location`);
        // Skip GPS verification if no pickup location is set
        // Update status directly
        const { error } = await supabase.rpc('update_shipment_status_safe', {
          p_shipment_id: shipmentId,
          p_new_status: 'driver_arrived',
          p_user_id: driverId,
        });
        
        if (error) {
          logger.error('Error marking driver arrived:', error);
          throw createError('Failed to update shipment status', 500, 'STATUS_UPDATE_FAILED');
        }
        
        logger.info(`Driver ${driverId} marked as arrived for shipment ${shipmentId} (no GPS verification)`);
        return;
      }
      
      const pickupCoords = shipment[0];
      
      // Verify driver is within 100m of pickup location
      const distance = this.calculateDistance(
        location.lat,
        location.lng,
        pickupCoords.lat,
        pickupCoords.lng
      );
      
      if (distance > 100) {
        throw createError(
          `You must be within 100 meters of pickup location. Current distance: ${Math.round(distance)}m`,
          400,
          'GPS_VERIFICATION_FAILED'
        );
      }
      
      // Update status
      const { error } = await supabase.rpc('update_shipment_status_safe', {
        p_shipment_id: shipmentId,
        p_new_status: 'driver_arrived',
        p_user_id: driverId,
      });
      
      if (error) {
        logger.error('Error marking driver arrived:', error);
        throw createError(error.message, 400, 'STATUS_UPDATE_FAILED');
      }
      
      // Update driver_arrival_time
      await supabase
        .from('shipments')
        .update({ driver_arrival_time: new Date().toISOString() })
        .eq('id', shipmentId);
      
      logger.info('Driver marked as arrived successfully');
    } catch (error) {
      logger.error('PickupVerificationService.markDriverArrived error:', { error });
      throw error;
    }
  }

  /**
   * Start pickup verification process
   */
  static async startVerification(
    shipmentId: string,
    driverId: string,
    request: StartVerificationRequest
  ): Promise<PickupVerification> {
    try {
      logger.info(`Starting verification for shipment ${shipmentId}`);
      
      // Check if verification already exists for this shipment
      const { data: existingVerification, error: checkError } = await supabase
        .from('pickup_verifications')
        .select('*')
        .eq('shipment_id', shipmentId)
        .maybeSingle();
      
      if (checkError) {
        logger.error('Error checking existing verification:', checkError);
        throw createError(checkError.message, 500, 'VERIFICATION_CHECK_FAILED');
      }
      
      // If verification already exists, return it (resume verification)
      if (existingVerification) {
        logger.info(`Verification already exists for shipment ${shipmentId}, resuming:`, existingVerification.id);
        
        // Update shipment status to pickup_verification_pending if not already
        await supabase.rpc('update_shipment_status_safe', {
          p_shipment_id: shipmentId,
          p_new_status: 'pickup_verification_pending',
          p_user_id: driverId,
        });
        
        return existingVerification as PickupVerification;
      }
      
      // Create new verification record using PostGIS function
      const { error: rpcError } = await supabase
        .rpc('create_pickup_verification', {
          p_shipment_id: shipmentId,
          p_driver_id: driverId,
          p_lat: request.location.lat,
          p_lng: request.location.lng,
          p_accuracy: request.location.accuracy
        });
      
      if (rpcError) {
        logger.error('Error creating verification record:', rpcError);
        throw createError(rpcError.message, 500, 'VERIFICATION_CREATE_FAILED');
      }
      
      // Update shipment status to pickup_verification_pending
      const { error: statusError } = await supabase.rpc('update_shipment_status_safe', {
        p_shipment_id: shipmentId,
        p_new_status: 'pickup_verification_pending',
        p_user_id: driverId,
      });
      
      if (statusError) {
        logger.error('Error updating shipment status:', statusError);
        throw createError(statusError.message, 500, 'STATUS_UPDATE_FAILED');
      }
      
      // Fetch the created verification record
      const { data: fetchedVerification, error: fetchError } = await supabase
        .from('pickup_verifications')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (fetchError || !fetchedVerification) {
        logger.error('Error fetching verification record:', fetchError);
        throw createError('Failed to fetch verification record', 500, 'VERIFICATION_CREATE_FAILED');
      }
      
      logger.info('Verification started successfully:', fetchedVerification.id);
      return fetchedVerification as PickupVerification;
    } catch (error) {
      logger.error('PickupVerificationService.startVerification error:', { error });
      throw error;
    }
  }

  /**
   * Upload a verification photo
   */
  static async uploadVerificationPhoto(
    verificationId: string,
    angle: PhotoAngle,
    photoUrl: string,
    location: { lat: number; lng: number }
  ): Promise<VerificationPhoto> {
    try {
      logger.info(`Uploading ${angle} photo for verification ${verificationId}`);
      
      // Get current verification
      const { data: verification, error: fetchError } = await supabase
        .from('pickup_verifications')
        .select('driver_photos')
        .eq('id', verificationId)
        .single();
      
      if (fetchError || !verification) {
        throw createError('Verification not found', 404, 'VERIFICATION_NOT_FOUND');
      }
      
      // Create photo data
      const photoData: VerificationPhoto = {
        id: `${Date.now()}`,
        url: photoUrl,
        angle,
        timestamp: new Date().toISOString(),
        location,
      };
      
      // Use PostgreSQL array append to avoid race conditions with parallel uploads
      // This is atomic and safe for concurrent requests
      const { error } = await supabase.rpc('append_verification_photo', {
        verification_id: verificationId,
        photo_data: photoData,
      });
      
      if (error) {
        // Fallback to read-modify-write if RPC doesn't exist yet
        logger.warn('RPC not available, using fallback method');
        
        const { data: verification, error: fetchError } = await supabase
          .from('pickup_verifications')
          .select('driver_photos')
          .eq('id', verificationId)
          .single();
        
        if (fetchError || !verification) {
          throw createError('Verification not found', 404, 'VERIFICATION_NOT_FOUND');
        }
        
        const currentPhotos = verification.driver_photos || [];
        const updatedPhotos = [...currentPhotos, photoData];
        
        const { error: updateError } = await supabase
          .from('pickup_verifications')
          .update({
            driver_photos: updatedPhotos,
          })
          .eq('id', verificationId);
        
        if (updateError) {
          logger.error('Error updating verification with photo:', updateError);
          throw createError(updateError.message, 500, 'PHOTO_UPLOAD_FAILED');
        }
      }
      
      logger.info('Photo uploaded successfully');
      return photoData;
    } catch (error) {
      logger.error('PickupVerificationService.uploadVerificationPhoto error:', { error });
      throw error;
    }
  }

  /**
   * Submit completed verification
   */
  static async submitVerification(
    shipmentId: string,
    driverId: string,
    request: SubmitVerificationRequest
  ): Promise<{ verification: PickupVerification; nextAction: string }> {
    try {
      logger.info(`Submitting verification ${request.verificationId}`);
      
      // Get verification and shipment
      const { data: verification, error: verificationError } = await supabase
        .from('pickup_verifications')
        .select('*, shipment_id')
        .eq('id', request.verificationId)
        .single();
      
      if (verificationError || !verification) {
        throw createError('Verification not found', 404, 'VERIFICATION_NOT_FOUND');
      }
      
      // Check minimum photo requirement
      if ((verification.driver_photos || []).length < 6) {
        throw createError('Minimum 6 photos required', 400, 'INSUFFICIENT_PHOTOS');
      }
      
      // Get shipment for distance calculation
      const { data: shipment } = await supabase
        .from('shipments')
        .select('pickup_lat, pickup_lng')
        .eq('id', shipmentId)
        .single();
      
      const distance = shipment ? this.calculateDistance(
        request.location.lat,
        request.location.lng,
        shipment.pickup_lat,
        shipment.pickup_lng
      ) : 0;
      
      // Update verification record
      const { data: updated, error: updateError } = await supabase
        .from('pickup_verifications')
        .update({
          verification_status: request.decision,
          differences_description: request.differences ? JSON.stringify(request.differences) : null,
          comparison_notes: request.driverNotes ? { driver: request.driverNotes } : null,
          distance_from_address_meters: distance,
          verification_completed_at: new Date().toISOString(),
        })
        .eq('id', request.verificationId)
        .select()
        .single();
      
      if (updateError) {
        logger.error('Error submitting verification:', updateError);
        throw createError(updateError.message, 500, 'VERIFICATION_SUBMIT_FAILED');
      }
      
      let nextAction = 'wait_for_client';
      
      // Handle decision outcomes
      if (request.decision === 'matches') {
        await this.approveVerification(shipmentId, driverId);
        nextAction = 'mark_picked_up';
      } else if (request.decision === 'major_issues') {
        await this.cancelAtPickup(
          shipmentId,
          driverId,
          {
            cancellationType: 'at_pickup_mismatch',
            reason: request.driverNotes || 'Major vehicle condition issues found',
            pickupVerificationId: request.verificationId,
          }
        );
        nextAction = 'cancelled';
      }
      // For minor_differences, wait for client response (default nextAction)
      
      logger.info('Verification submitted successfully');
      return {
        verification: updated as PickupVerification,
        nextAction,
      };
    } catch (error) {
      logger.error('PickupVerificationService.submitVerification error:', { error });
      throw error;
    }
  }

  /**
   * Client responds to verification with minor differences
   */
  static async clientRespondToVerification(
    shipmentId: string,
    clientId: string,
    response: ClientVerificationResponse
  ): Promise<PickupVerification> {
    try {
      logger.info(`Client responding to verification ${response.verificationId}`);
      
      // Get verification
      const { data: verification, error: fetchError } = await supabase
        .from('pickup_verifications')
        .select('*')
        .eq('id', response.verificationId)
        .single();
      
      if (fetchError || !verification) {
        throw createError('Verification not found', 404, 'VERIFICATION_NOT_FOUND');
      }
      
      // Update with client response
      const { data: updated, error } = await supabase
        .from('pickup_verifications')
        .update({
          client_response: response.response,
          client_response_notes: response.notes,
          client_responded_at: new Date().toISOString(),
        })
        .eq('id', response.verificationId)
        .select()
        .single();
      
      if (error) {
        logger.error('Error updating verification with client response:', error);
        throw createError(error.message, 500, 'CLIENT_RESPONSE_FAILED');
      }
      
      // Handle response
      if (response.response === 'approved') {
        await this.approveVerification(shipmentId, verification.driver_id);
      } else if (response.response === 'disputed') {
        await this.cancelAtPickup(
          shipmentId,
          clientId,
          {
            cancellationType: 'at_pickup_mismatch',
            reason: response.notes || 'Client disputed verification differences',
            pickupVerificationId: response.verificationId,
          }
        );
      }
      
      logger.info('Client response recorded successfully');
      return updated as PickupVerification;
    } catch (error) {
      logger.error('PickupVerificationService.clientRespondToVerification error:', { error });
      throw error;
    }
  }

  /**
   * Approve verification and mark as pickup_verified
   */
  private static async approveVerification(
    shipmentId: string,
    userId: string
  ): Promise<void> {
    // Update shipment status
    await supabase.rpc('update_shipment_status_safe', {
      p_shipment_id: shipmentId,
      p_new_status: 'pickup_verified',
      p_user_id: userId,
    });
    
    // Update shipment pickup_verified fields
    await supabase
      .from('shipments')
      .update({
        pickup_verified: true,
        pickup_verified_at: new Date().toISOString(),
        pickup_verification_status: 'verified',
      })
      .eq('id', shipmentId);
  }

  /**
   * Mark vehicle as picked up
   */
  static async markPickedUp(shipmentId: string, driverId: string): Promise<void> {
    try {
      logger.info(`Marking shipment ${shipmentId} as picked up`);
      
      const { error } = await supabase.rpc('update_shipment_status_safe', {
        p_shipment_id: shipmentId,
        p_new_status: 'picked_up',
        p_user_id: driverId,
      });
      
      if (error) {
        logger.error('Error marking as picked up:', error);
        throw createError(error.message, 400, 'STATUS_UPDATE_FAILED');
      }
      
      // Update actual_pickup_time
      await supabase
        .from('shipments')
        .update({ actual_pickup_time: new Date().toISOString() })
        .eq('id', shipmentId);
      
      logger.info('Shipment marked as picked up successfully');
    } catch (error) {
      logger.error('PickupVerificationService.markPickedUp error:', { error });
      throw error;
    }
  }

  /**
   * Mark shipment as in transit
   */
  static async markInTransit(shipmentId: string, driverId: string): Promise<void> {
    try {
      logger.info(`Marking shipment ${shipmentId} as in transit`);
      
      const { error } = await supabase.rpc('update_shipment_status_safe', {
        p_shipment_id: shipmentId,
        p_new_status: 'in_transit',
        p_user_id: driverId,
      });
      
      if (error) {
        logger.error('Error marking as in transit:', error);
        throw createError(error.message, 400, 'STATUS_UPDATE_FAILED');
      }
      
      logger.info('Shipment marked as in transit successfully');
    } catch (error) {
      logger.error('PickupVerificationService.markInTransit error:', { error });
      throw error;
    }
  }

  /**
   * Cancel shipment at pickup
   */
  static async cancelAtPickup(
    shipmentId: string,
    userId: string,
    request: CancelShipmentRequest
  ): Promise<CancellationRecord> {
    try {
      logger.info(`Cancelling shipment ${shipmentId} at pickup`);
      
      // Get shipment details
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .select('estimated_price, client_id, driver_id, status')
        .eq('id', shipmentId)
        .single();
      
      if (shipmentError || !shipment) {
        throw createError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND');
      }
      
      // Calculate refunds
      const { data: refundData, error: refundError } = await supabase
        .rpc('calculate_cancellation_refund', {
          p_original_amount: shipment.estimated_price,
          p_cancellation_type: request.cancellationType,
          p_fraud_confirmed: request.fraudConfirmed || false,
        })
        .single();
      
      if (refundError) {
        logger.error('Error calculating refund:', refundError);
        throw createError(refundError.message, 500, 'REFUND_CALCULATION_FAILED');
      }
      
      // Determine canceller role
      let cancellerRole: 'client' | 'driver' | 'admin' = 'driver';
      if (userId === shipment.client_id) cancellerRole = 'client';
      // Admin check would be done in controller
      
      // Create cancellation record
      const { data: cancellation, error } = await supabase
        .from('cancellation_records')
        .insert({
          shipment_id: shipmentId,
          cancelled_by: userId,
          canceller_role: cancellerRole,
          cancellation_type: request.cancellationType,
          cancellation_stage: this.mapStatusToCancellationStage(shipment.status),
          reason_category: this.categorizeReason(request.reason),
          reason_description: request.reason,
          fraud_confirmed: request.fraudConfirmed || false,
          original_amount: shipment.estimated_price,
          client_refund_amount: refundData.client_refund,
          driver_compensation_amount: refundData.driver_compensation,
          platform_fee_amount: refundData.platform_fee,
          refund_status: 'pending',
          pickup_verification_id: request.pickupVerificationId,
          evidence_photos: request.evidenceUrls || [],
        })
        .select()
        .single();
      
      if (error) {
        logger.error('Error creating cancellation record:', error);
        throw createError(error.message, 500, 'CANCELLATION_CREATE_FAILED');
      }
      
      // Update shipment status to cancelled
      await supabase
        .from('shipments')
        .update({
          status: 'cancelled',
          cancellation_record_id: cancellation.id,
        })
        .eq('id', shipmentId);
      
      logger.info('Shipment cancelled at pickup successfully');
      return cancellation as CancellationRecord;
    } catch (error) {
      logger.error('PickupVerificationService.cancelAtPickup error:', { error });
      throw error;
    }
  }

  /**
   * Get pickup verification for a shipment
   */
  static async getVerification(shipmentId: string): Promise<PickupVerification | null> {
    try {
      const { data, error } = await supabase
        .from('pickup_verifications')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }
      
      return data as PickupVerification;
    } catch (error) {
      logger.error('PickupVerificationService.getVerification error:', { error });
      throw error;
    }
  }

  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   * @returns Distance in meters
   */
  private static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Map shipment status to cancellation stage
   */
  private static mapStatusToCancellationStage(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'accepted': 'accepted',
      'driver_en_route': 'en_route',
      'driver_arrived': 'arrived',
      'pickup_verification_pending': 'arrived',
      'pickup_verified': 'pickup_verified',
      'picked_up': 'picked_up',
      'in_transit': 'in_transit',
      'delivered': 'delivered',
    };
    return statusMap[status] || 'pending';
  }

  /**
   * Categorize cancellation reason
   */
  private static categorizeReason(reason: string): string {
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('mismatch') || lowerReason.includes('wrong')) return 'vehicle_mismatch';
    if (lowerReason.includes('damage')) return 'significant_damage';
    if (lowerReason.includes('drivable') || lowerReason.includes('mechanical')) return 'not_drivable';
    if (lowerReason.includes('safety')) return 'safety_concern';
    if (lowerReason.includes('fraud')) return 'client_fraud';
    if (lowerReason.includes('emergency')) return 'emergency';
    return 'other';
  }
}

export default PickupVerificationService;
