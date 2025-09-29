/**
 * Supabase service for handling database operations
 */
import { supabase, supabaseAdmin } from '@lib/supabase';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';
import { 
  ShipmentStatus, 
  UserRole, 
  DraftShipmentData, 
  ValidationResult, 
  ShipmentProgress 
} from '../types/api.types';
import { Database } from '@lib/database.types';
import { 
  validateDraftShipment, 
  validateCompleteShipment, 
  calculateShipmentProgress,
  canCompleteShipment 
} from '../utils/shipmentValidation';

/**
 * User service for managing user profiles
 */
export const userService = {
  /**
   * Get a user by ID
   */
  async getUserById(id: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw createError(error.message, 404, 'USER_NOT_FOUND');
      }

      return data;
    } catch (error) {
      logger.error('Error getting user by ID', { error, userId: id });
      throw error;
    }
  },

  /**
   * Get users with pagination
   */
  async getUsers(page = 1, limit = 10, role?: UserRole) {
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      if (role) {
        query = query.eq('role', role);
      }

      const { data, error, count } = await query
        .range((page - 1) * limit, page * limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        throw createError(error.message, 500, 'DATABASE_ERROR');
      }

      return {
        data,
        meta: {
          page,
          limit,
          total: count || 0,
          totalPages: count ? Math.ceil(count / limit) : 0,
        },
      };
    } catch (error) {
      logger.error('Error getting users', { error, page, limit, role });
      throw error;
    }
  },

  /**
   * Update user profile
   */
  async updateUserProfile(id: string, updates: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar_url?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createError(error.message, 400, 'UPDATE_FAILED');
      }

      return data;
    } catch (error) {
      logger.error('Error updating user profile', { error, userId: id, updates });
      throw error;
    }
  },

  /**
   * Update user rating (for drivers)
   */
  async updateUserRating(id: string, rating: number) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          rating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createError(error.message, 400, 'RATING_UPDATE_FAILED');
      }

      return data;
    } catch (error) {
      logger.error('Error updating user rating', { error, userId: id, rating });
      throw error;
    }
  },

  /**
   * Get drivers within a radius (using PostGIS)
   */
  async getDriversNearLocation(lat: number, lng: number, radiusKm = 10) {
    try {
      const { data, error } = await supabase.rpc('get_drivers_near_location', {
        user_lat: lat,
        user_lng: lng,
        radius_km: radiusKm,
      });

      if (error) {
        throw createError(error.message, 500, 'LOCATION_QUERY_FAILED');
      }

      return data;
    } catch (error) {
      logger.error('Error getting nearby drivers', { error, lat, lng, radiusKm });
      throw error;
    }
  },
};

/**
 * Shipment service for managing shipments
 */
export const shipmentService = {
  /**
   * Create or update a draft shipment
   */
  async createOrUpdateDraft(draftData: DraftShipmentData, draftId?: string) {
    try {
      const timestamp = new Date().toISOString();
      
      if (draftId) {
        // Update existing draft
        const { data, error } = await supabase
          .from('shipments')
          .update({
            ...draftData,
            status: 'draft',
            updated_at: timestamp,
          })
          .eq('id', draftId)
          .eq('client_id', draftData.client_id)
          .eq('status', 'draft')
          .select(`
            *,
            client:client_id(id, first_name, last_name, email, phone)
          `)
          .single();

        if (error) {
          throw createError(error.message, 400, 'DRAFT_UPDATE_FAILED');
        }

        return data;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('shipments')
          .insert({
            ...draftData,
            status: 'draft',
            created_at: timestamp,
            updated_at: timestamp,
            // Set default title if not provided
            title: draftData.title || 'Draft Shipment',
            // Set minimal description if not provided
            description: draftData.description || 'Draft shipment in progress',
            // Set minimal addresses if not provided
            pickup_address: draftData.pickup_address || 'TBD',
            delivery_address: draftData.delivery_address || 'TBD',
          })
          .select(`
            *,
            client:client_id(id, first_name, last_name, email, phone)
          `)
          .single();

        if (error) {
          throw createError(error.message, 400, 'DRAFT_CREATION_FAILED');
        }

        return data;
      }
    } catch (error) {
      logger.error('Error creating/updating draft shipment', { error, draftData, draftId });
      throw error;
    }
  },

  /**
   * Get draft shipments for a user
   */
  async getUserDrafts(clientId: string, page = 1, limit = 10) {
    try {
      const { data, error, count } = await supabase
        .from('shipments')
        .select(`
          *,
          client:client_id(id, first_name, last_name, email, phone)
        `, { count: 'exact' })
        .eq('client_id', clientId)
        .eq('status', 'draft')
        .range((page - 1) * limit, page * limit - 1)
        .order('updated_at', { ascending: false });

      if (error) {
        throw createError(error.message, 500, 'DATABASE_ERROR');
      }

      return {
        data,
        meta: {
          page,
          limit,
          total: count || 0,
          totalPages: count ? Math.ceil(count / limit) : 0,
        },
      };
    } catch (error) {
      logger.error('Error getting user drafts', { error, clientId, page, limit });
      throw error;
    }
  },

  /**
   * Delete a draft shipment
   */
  async deleteDraft(draftId: string, clientId: string) {
    try {
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', draftId)
        .eq('client_id', clientId)
        .eq('status', 'draft');

      if (error) {
        throw createError(error.message, 400, 'DRAFT_DELETION_FAILED');
      }

      return { success: true };
    } catch (error) {
      logger.error('Error deleting draft shipment', { error, draftId, clientId });
      throw error;
    }
  },

  /**
   * Convert draft to pending shipment (final submission)
   */
  async submitDraft(draftId: string, clientId: string, finalData?: Partial<DraftShipmentData>) {
    try {
      // Get existing draft
      const { data: draft, error: fetchError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', draftId)
        .eq('client_id', clientId)
        .eq('status', 'draft')
        .single();

      if (fetchError) {
        throw createError('Draft not found', 404, 'DRAFT_NOT_FOUND');
      }

      // Merge with final data if provided
      const completeData = { ...draft, ...finalData };

      // Update status to pending
      const { data, error } = await supabase
        .from('shipments')
        .update({
          ...completeData,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId)
        .select(`
          *,
          client:client_id(id, first_name, last_name, email, phone)
        `)
        .single();

      if (error) {
        throw createError(error.message, 400, 'SUBMISSION_FAILED');
      }

      return data;
    } catch (error) {
      logger.error('Error submitting draft shipment', { error, draftId, clientId });
      throw error;
    }
  },

  /**
   * Validate draft shipment data
   */
  async validateDraftData(draftData: DraftShipmentData): Promise<ValidationResult> {
    try {
      return validateDraftShipment(draftData);
    } catch (error) {
      logger.error('Error validating draft data', { error, draftData });
      throw error;
    }
  },

  /**
   * Validate complete shipment data for submission
   */
  async validateCompleteData(draftData: DraftShipmentData): Promise<ValidationResult> {
    try {
      return validateCompleteShipment(draftData);
    } catch (error) {
      logger.error('Error validating complete data', { error, draftData });
      throw error;
    }
  },

  /**
   * Get shipment progress information
   */
  async getShipmentProgress(draftData: DraftShipmentData): Promise<ShipmentProgress> {
    try {
      return calculateShipmentProgress(draftData);
    } catch (error) {
      logger.error('Error calculating shipment progress', { error, draftData });
      throw error;
    }
  },

  /**
   * Check if draft can be submitted as complete shipment
   */
  async canSubmitDraft(draftData: DraftShipmentData): Promise<boolean> {
    try {
      return canCompleteShipment(draftData);
    } catch (error) {
      logger.error('Error checking draft submission readiness', { error, draftData });
      throw error;
    }
  },
  /**
   * Get a shipment by ID
   */
  async getShipmentById(id: string) {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          client:client_id(id, first_name, last_name, email, phone, avatar_url),
          driver:driver_id(id, first_name, last_name, email, phone, avatar_url),
          tracking_events(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        throw createError(error.message, 404, 'SHIPMENT_NOT_FOUND');
      }

      return data;
    } catch (error) {
      logger.error('Error getting shipment by ID', { error, shipmentId: id });
      throw error;
    }
  },

  /**
   * Get shipments with pagination and filters
   */
  async getShipments(
    page = 1,
    limit = 10,
    filters: {
      clientId?: string;
      driverId?: string;
      status?: ShipmentStatus;
    } = {},
  ) {
    try {
      let query = supabase
        .from('shipments')
        .select(`
          *,
          client:client_id(id, first_name, last_name, avatar_url),
          driver:driver_id(id, first_name, last_name, avatar_url)
        `, { count: 'exact' });

      // Apply filters
      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters.driverId) {
        query = query.eq('driver_id', filters.driverId);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error, count } = await query
        .range((page - 1) * limit, page * limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        throw createError(error.message, 500, 'DATABASE_ERROR');
      }

      return {
        data,
        meta: {
          page,
          limit,
          total: count || 0,
          totalPages: count ? Math.ceil(count / limit) : 0,
        },
      };
    } catch (error) {
      logger.error('Error getting shipments', { error, page, limit, filters });
      throw error;
    }
  },

  /**
   * Create a tracking event
   */
  async createTrackingEvent(
    shipmentId: string,
    eventType: Database['public']['Enums']['tracking_event_type'],
    createdBy: string,
    location?: unknown,
    notes?: string,
  ) {
    try {
      const { data, error } = await supabase.rpc('create_tracking_event', {
        p_shipment_id: shipmentId,
        p_event_type: eventType,
        p_location: location,
        p_notes: notes,
      });

      if (error) {
        throw createError(error.message, 500, 'EVENT_CREATION_FAILED');
      }

      return data;
    } catch (error) {
      logger.error('Error creating tracking event', {
        error,
        shipmentId,
        eventType,
        createdBy,
      });
      throw error;
    }
  },

  /**
   * Create a new shipment
   */
  async createShipment(shipmentData: {
    client_id: string;
    pickup_location: unknown;
    delivery_location: unknown;
    pickup_address: string;
    delivery_address: string;
    description: string;
    title?: string; // Add title field
    status?: string; // Add status field
    vehicle_type?: string; // Add vehicle_type field
    distance_miles?: number; // Add distance_miles field
    is_accident_recovery?: boolean; // Add is_accident_recovery field
    vehicle_count?: number; // Add vehicle_count field
    estimated_price?: number;
    scheduled_pickup?: string;
  }) {
    try {
      const { data, error } = await supabaseAdmin
        .from('shipments')
        .insert({
          client_id: shipmentData.client_id,
          pickup_location: shipmentData.pickup_location,
          delivery_location: shipmentData.delivery_location,
          pickup_address: shipmentData.pickup_address,
          delivery_address: shipmentData.delivery_address,
          description: shipmentData.description,
          title: shipmentData.title || shipmentData.description, // Use title or fallback to description
          status: shipmentData.status || 'pending',
          vehicle_type: shipmentData.vehicle_type,
          estimated_distance_km: shipmentData.distance_miles ? shipmentData.distance_miles * 1.60934 : null, // Convert miles to km
          estimated_price: shipmentData.estimated_price,
          pickup_date: shipmentData.scheduled_pickup, // Map scheduled_pickup to pickup_date
          is_fragile: false, // Default value
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select(`
          *,
          client:client_id(id, first_name, last_name, email, phone)
        `)
        .single();

      if (error) {
        throw createError(error.message, 400, 'SHIPMENT_CREATION_FAILED');
      }

      return data;
    } catch (error) {
      logger.error('Error creating shipment', { error, shipmentData });
      throw error;
    }
  },

  /**
   * Update shipment status
   */
  async updateShipmentStatus(id: string, status: ShipmentStatus, driverId?: string) {
    try {
  const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (driverId) {
        updateData['driver_id'] = driverId;
      }

      if (status === 'accepted') {
        updateData['accepted_at'] = new Date().toISOString();
      } else if (status === 'delivered') {
        updateData['delivered_at'] = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('shipments')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          client:client_id(id, first_name, last_name, email, phone),
          driver:driver_id(id, first_name, last_name, email, phone)
        `)
        .single();

      if (error) {
        throw createError(error.message, 400, 'STATUS_UPDATE_FAILED');
      }

      return data;
    } catch (error) {
      logger.error('Error updating shipment status', { error, id, status, driverId });
      throw error;
    }
  },

  /**
   * Update shipment (general update)
   */
  async updateShipment(id: string, updateData: Record<string, any>) {
    try {
      // Ensure we always update the timestamp
      updateData['updated_at'] = new Date().toISOString();
      
      // Log detailed update information
      logger.info('Updating shipment', { 
        shipmentId: id, 
        updateFields: Object.keys(updateData),
        paymentStatus: updateData['payment_status'],
        status: updateData['status']
      });

      // First, check if the shipment exists and get current status
      const { data: shipmentCheck, error: checkError } = await supabaseAdmin
        .from('shipments')
        .select('id, client_id, status, payment_status')
        .eq('id', id)
        .single();
        
      if (checkError || !shipmentCheck) {
        logger.error('Shipment not found for update', { id, error: checkError });
        throw createError(`Shipment not found: ${id}`, 404, 'SHIPMENT_NOT_FOUND');
      }

      logger.info('Shipment found for update', {
        shipmentId: id,
        currentStatus: shipmentCheck.status,
        currentPaymentStatus: shipmentCheck.payment_status,
        clientId: shipmentCheck.client_id,
        newStatus: updateData['status']
      });

      // Handle RLS policy constraint for status updates
      if (updateData['status'] === 'accepted' && 
          !['pending', 'open', 'cancelled'].includes(shipmentCheck.status)) {
        logger.info('Status update to accepted requires intermediate step due to RLS policy', {
          currentStatus: shipmentCheck.status,
          targetStatus: updateData['status']
        });
        
        // First update to 'open' status which is allowed by RLS
        const { error: intermediateError } = await supabaseAdmin
          .from('shipments')
          .update({
            status: 'open',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (intermediateError) {
          logger.error('Failed to update shipment to intermediate open status', {
            error: intermediateError.message,
            shipmentId: id
          });
          throw createError(`Failed intermediate status update: ${intermediateError.message}`, 400, 'SHIPMENT_UPDATE_FAILED');
        }

        logger.info('Successfully updated shipment to intermediate open status', { shipmentId: id });
      }

      // Perform the main update - split into two operations to avoid RLS issues
      const { error: updateError } = await supabaseAdmin
        .from('shipments')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        logger.error('Error in supabase update operation', { 
          error: updateError.message, 
          code: updateError.code, 
          details: updateError.details,
          shipmentId: id,
          hint: updateError.hint
        });
        throw createError(`Update operation failed: ${updateError.message}`, 400, 'SHIPMENT_UPDATE_FAILED');
      }

      // Fetch the updated record separately to ensure we can see it
      const { data: updatedData, error: fetchError } = await supabaseAdmin
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        logger.error('Error fetching updated shipment', {
          error: fetchError.message,
          code: fetchError.code,
          shipmentId: id
        });
        throw createError(`Failed to fetch updated shipment: ${fetchError.message}`, 500, 'SHIPMENT_FETCH_FAILED');
      }

      if (!updatedData) {
        logger.error('No data returned after update', { shipmentId: id });
        throw createError('No data returned after shipment update', 500, 'SHIPMENT_UPDATE_NO_DATA');
      }

      // Log successful update
      logger.info('Shipment updated successfully', { 
        shipmentId: id, 
        updatedFields: Object.keys(updateData),
        newStatus: updatedData.status,
        newPaymentStatus: updatedData.payment_status
      });

      return updatedData;
    } catch (error) {
      logger.error('Error updating shipment', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        shipmentId: id, 
        updateData
      });
      throw error;
    }
  },

  /**
   * Get shipments by proximity (using PostGIS)
   */
  async getShipmentsNearLocation(lat: number, lng: number, radiusKm = 20, status?: ShipmentStatus) {
    try {
      const { data, error } = await supabase.rpc('get_shipments_near_location', {
        user_lat: lat,
        user_lng: lng,
        radius_km: radiusKm,
        shipment_status: status || null,
      });

      if (error) {
        throw createError(error.message, 500, 'LOCATION_QUERY_FAILED');
      }

      return data;
    } catch (error) {
      logger.error('Error getting nearby shipments', { error, lat, lng, radiusKm, status });
      throw error;
    }
  },

  /**
   * Get tracking events for a shipment
   */
  async getTrackingEvents(shipmentId: string) {
    try {
      const { data, error } = await supabase
        .from('tracking_events')
        .select(`
          *,
          created_by_user:created_by(id, first_name, last_name, role)
        `)
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: true });

      if (error) {
        throw createError(error.message, 500, 'DATABASE_ERROR');
      }

      return data;
    } catch (error) {
      logger.error('Error getting tracking events', { error, shipmentId });
      throw error;
    }
  },

  /**
   * Assign driver to shipment (admin only)
   */
  async assignDriverToShipment(shipmentId: string, driverId: string) {
    try {
      // First, verify shipment exists and is available
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .select('id, status, driver_id')
        .eq('id', shipmentId)
        .single();

      if (shipmentError) {
        throw createError(shipmentError.message, 404, 'SHIPMENT_NOT_FOUND');
      }

      if (shipment.status !== 'pending') {
        throw createError('Shipment is not available for assignment', 400, 'INVALID_STATUS');
      }

      if (shipment.driver_id) {
        throw createError('Shipment already has a driver assigned', 400, 'ALREADY_ASSIGNED');
      }

      // Verify driver exists
      const { error: driverError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', driverId)
        .eq('role', 'driver')
        .single();

      if (driverError) {
        throw createError('Driver not found', 404, 'DRIVER_NOT_FOUND');
      }

      // Verify driver has applied for this shipment
      const { error: applicationError } = await supabase
        .from('job_applications')
        .select('id')
        .eq('shipment_id', shipmentId)
        .eq('driver_id', driverId)
        .single();

      if (applicationError) {
        throw createError('Driver has not applied for this shipment', 400, 'NO_APPLICATION');
      }

      // Update shipment with assigned driver
      const { data: updatedShipment, error: updateError } = await supabase
        .from('shipments')
        .update({
          driver_id: driverId,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipmentId)
        .select()
        .single();

      if (updateError) {
        throw createError(updateError.message, 500, 'UPDATE_FAILED');
      }

      // Update application status
      await supabase
        .from('job_applications')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('shipment_id', shipmentId)
        .eq('driver_id', driverId);

      // Reject other applications
      await supabase
        .from('job_applications')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('shipment_id', shipmentId)
        .neq('driver_id', driverId);

      return updatedShipment;
    } catch (error) {
      logger.error('Error assigning driver to shipment', { error, shipmentId, driverId });
      throw error;
    }
  },

  /**
   * Get applicants for a shipment
   */
  async getShipmentApplicants(shipmentId: string) {
    try {
      // Use admin client to ensure RLS does not hide pending applications from authorized admins
      const { data, error } = await supabaseAdmin
        .from('job_applications')
        .select(`
          *,
          driver:driver_id(
            id, 
            first_name, 
            last_name, 
            email, 
            phone, 
            avatar_url, 
            ratings(score, created_at),
            driver_details(*)
          )
        `)
        .eq('shipment_id', shipmentId)
        .eq('status', 'pending')
        .order('applied_at', { ascending: true });

      if (error) {
        throw createError(error.message, 500, 'FETCH_FAILED');
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting shipment applicants', { error, shipmentId });
      throw error;
    }
  },
};
