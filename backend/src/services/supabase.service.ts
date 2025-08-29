/**
 * Supabase service for handling database operations
 */
import { supabase, supabaseAdmin } from '@lib/supabase';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';
import { ShipmentStatus, UserRole } from '../types/api.types';
import { Database } from '@lib/database.types';

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
    estimated_price?: number;
    scheduled_pickup?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .insert({
          ...shipmentData,
          status: 'pending',
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
