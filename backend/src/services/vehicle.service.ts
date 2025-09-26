/**
 * Vehicle service for managing user vehicle profiles
 */
import { supabase } from '@lib/supabase';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';
import { 
  UserVehicle, 
  CreateVehicleRequest, 
  UpdateVehicleRequest,
  VehicleType,
  PaginationParams,
  PaginationMeta 
} from '../types/api.types';
import { Database } from '@lib/database.types';

type UserVehicleRow = Database['public']['Tables']['user_vehicles']['Row'];
type UserVehicleInsert = Database['public']['Tables']['user_vehicles']['Insert'];
type UserVehicleUpdate = Database['public']['Tables']['user_vehicles']['Update'];

/**
 * Vehicle service for managing user vehicle profiles
 */
export const vehicleService = {
  /**
   * Get all vehicles for a user
   */
  async getUserVehicles(
    userId: string, 
    activeOnly: boolean = true,
    pagination?: PaginationParams
  ): Promise<{ vehicles: UserVehicle[]; meta?: PaginationMeta }> {
    try {
      let query = supabase
        .from('user_vehicles')
        .select('*')
        .eq('user_id', userId);

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      // Add sorting - primary vehicles first, then by created_at desc
      query = query.order('is_primary', { ascending: false })
                  .order('created_at', { ascending: false });

      // Add pagination if provided
      if (pagination?.page && pagination?.limit) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query.range(offset, offset + pagination.limit - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        throw createError(error.message, 400, 'VEHICLES_FETCH_FAILED');
      }

      const vehicles = data?.map(this.mapRowToVehicle) || [];

      // Calculate pagination metadata if pagination was requested
      let meta: PaginationMeta | undefined;
      if (pagination?.page && pagination?.limit && count !== null) {
        meta = {
          page: pagination.page,
          limit: pagination.limit,
          total: count,
          totalPages: Math.ceil(count / pagination.limit),
        };
      }

      return meta ? { vehicles, meta } : { vehicles };
    } catch (error) {
      logger.error('Error fetching user vehicles', { error, userId, activeOnly, pagination });
      throw error;
    }
  },

  /**
   * Get a specific vehicle by ID
   */
  async getVehicleById(vehicleId: string, userId: string): Promise<UserVehicle> {
    try {
      const { data, error } = await supabase
        .from('user_vehicles')
        .select('*')
        .eq('id', vehicleId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        throw createError(error.message, 404, 'VEHICLE_NOT_FOUND');
      }

      if (!data) {
        throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
      }

      return this.mapRowToVehicle(data);
    } catch (error) {
      logger.error('Error fetching vehicle by ID', { error, vehicleId, userId });
      throw error;
    }
  },

  /**
   * Get user's primary vehicle
   */
  async getPrimaryVehicle(userId: string): Promise<UserVehicle | null> {
    try {
      const { data, error } = await supabase
        .from('user_vehicles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw createError(error.message, 400, 'PRIMARY_VEHICLE_FETCH_FAILED');
      }

      return data ? this.mapRowToVehicle(data) : null;
    } catch (error) {
      logger.error('Error fetching primary vehicle', { error, userId });
      throw error;
    }
  },

  /**
   * Create a new vehicle
   */
  async createVehicle(userId: string, vehicleData: CreateVehicleRequest): Promise<UserVehicle> {
    try {
      // Validate year
      const currentYear = new Date().getFullYear();
      if (vehicleData.year < 1900 || vehicleData.year > currentYear + 2) {
        throw createError('Invalid vehicle year', 400, 'INVALID_YEAR');
      }

      // Check for duplicate nickname if provided
      if (vehicleData.nickname) {
        const { data: existingNickname } = await supabase
          .from('user_vehicles')
          .select('id')
          .eq('user_id', userId)
          .eq('nickname', vehicleData.nickname)
          .eq('is_active', true)
          .single();

        if (existingNickname) {
          throw createError('Vehicle nickname already exists', 400, 'NICKNAME_EXISTS');
        }
      }

      const insertData: UserVehicleInsert = {
        user_id: userId,
        vehicle_type: vehicleData.vehicle_type,
        make: vehicleData.make.trim(),
        model: vehicleData.model.trim(),
        year: vehicleData.year,
        color: vehicleData.color?.trim() || null,
        license_plate: vehicleData.license_plate?.trim().toUpperCase() || null,
        nickname: vehicleData.nickname?.trim() || null,
        is_primary: vehicleData.is_primary || false,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('user_vehicles')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw createError(error.message, 400, 'VEHICLE_CREATE_FAILED');
      }

      logger.info('Vehicle created successfully', { 
        vehicleId: data.id, 
        userId, 
        make: vehicleData.make, 
        model: vehicleData.model 
      });

      return this.mapRowToVehicle(data);
    } catch (error) {
      logger.error('Error creating vehicle', { error, userId, vehicleData });
      throw error;
    }
  },

  /**
   * Update a vehicle
   */
  async updateVehicle(
    vehicleId: string, 
    userId: string, 
    updates: UpdateVehicleRequest
  ): Promise<UserVehicle> {
    try {
      // Validate year if provided
      if (updates.year) {
        const currentYear = new Date().getFullYear();
        if (updates.year < 1900 || updates.year > currentYear + 2) {
          throw createError('Invalid vehicle year', 400, 'INVALID_YEAR');
        }
      }

      // Check for duplicate nickname if provided
      if (updates.nickname) {
        const { data: existingNickname } = await supabase
          .from('user_vehicles')
          .select('id')
          .eq('user_id', userId)
          .eq('nickname', updates.nickname)
          .eq('is_active', true)
          .neq('id', vehicleId)
          .single();

        if (existingNickname) {
          throw createError('Vehicle nickname already exists', 400, 'NICKNAME_EXISTS');
        }
      }

      const updateData: UserVehicleUpdate = {};
      
      if (updates.vehicle_type !== undefined) updateData.vehicle_type = updates.vehicle_type;
      if (updates.make !== undefined) updateData.make = updates.make.trim();
      if (updates.model !== undefined) updateData.model = updates.model.trim();
      if (updates.year !== undefined) updateData.year = updates.year;
      if (updates.color !== undefined) updateData.color = updates.color?.trim() || null;
      if (updates.license_plate !== undefined) updateData.license_plate = updates.license_plate?.trim().toUpperCase() || null;
      if (updates.nickname !== undefined) updateData.nickname = updates.nickname?.trim() || null;
      if (updates.is_primary !== undefined) updateData.is_primary = updates.is_primary;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const { data, error } = await supabase
        .from('user_vehicles')
        .update(updateData)
        .eq('id', vehicleId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw createError(error.message, 400, 'VEHICLE_UPDATE_FAILED');
      }

      if (!data) {
        throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
      }

      logger.info('Vehicle updated successfully', { vehicleId, userId, updates });

      return this.mapRowToVehicle(data);
    } catch (error) {
      logger.error('Error updating vehicle', { error, vehicleId, userId, updates });
      throw error;
    }
  },

  /**
   * Delete a vehicle (soft delete)
   */
  async deleteVehicle(vehicleId: string, userId: string): Promise<void> {
    try {
      // Check if this is the primary vehicle
      const vehicle = await this.getVehicleById(vehicleId, userId);
      
      const { error } = await supabase
        .from('user_vehicles')
        .update({ is_active: false, is_primary: false })
        .eq('id', vehicleId)
        .eq('user_id', userId);

      if (error) {
        throw createError(error.message, 400, 'VEHICLE_DELETE_FAILED');
      }

      // If this was the primary vehicle, promote another vehicle to primary
      if (vehicle.is_primary) {
        await this.promoteToPrimary(userId);
      }

      logger.info('Vehicle deleted successfully', { vehicleId, userId });
    } catch (error) {
      logger.error('Error deleting vehicle', { error, vehicleId, userId });
      throw error;
    }
  },

  /**
   * Set a vehicle as primary
   */
  async setPrimaryVehicle(vehicleId: string, userId: string): Promise<UserVehicle> {
    try {
      // First unset all primary vehicles for this user
      await supabase
        .from('user_vehicles')
        .update({ is_primary: false })
        .eq('user_id', userId);

      // Then set the selected vehicle as primary
      const { data, error } = await supabase
        .from('user_vehicles')
        .update({ is_primary: true })
        .eq('id', vehicleId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .select()
        .single();

      if (error) {
        throw createError(error.message, 400, 'PRIMARY_VEHICLE_SET_FAILED');
      }

      if (!data) {
        throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
      }

      logger.info('Primary vehicle set successfully', { vehicleId, userId });

      return this.mapRowToVehicle(data);
    } catch (error) {
      logger.error('Error setting primary vehicle', { error, vehicleId, userId });
      throw error;
    }
  },

  /**
   * Promote the most recently created vehicle to primary (used after deleting primary)
   */
  async promoteToPrimary(userId: string): Promise<void> {
    try {
      const { data } = await supabase
        .from('user_vehicles')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        await supabase
          .from('user_vehicles')
          .update({ is_primary: true })
          .eq('id', data.id);

        logger.info('New primary vehicle promoted', { vehicleId: data.id, userId });
      }
    } catch (error) {
      logger.error('Error promoting vehicle to primary', { error, userId });
      // Don't throw error as this is a cleanup operation
    }
  },

  /**
   * Get vehicle count for a user
   */
  async getVehicleCount(userId: string, activeOnly: boolean = true): Promise<number> {
    try {
      let query = supabase
        .from('user_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { count, error } = await query;

      if (error) {
        throw createError(error.message, 400, 'VEHICLE_COUNT_FAILED');
      }

      return count || 0;
    } catch (error) {
      logger.error('Error getting vehicle count', { error, userId, activeOnly });
      throw error;
    }
  },

  /**
   * Map database row to vehicle interface
   */
  mapRowToVehicle(row: UserVehicleRow): UserVehicle {
    return {
      id: row.id,
      user_id: row.user_id,
      vehicle_type: row.vehicle_type as VehicleType,
      make: row.make,
      model: row.model,
      year: row.year,
      color: row.color,
      license_plate: row.license_plate,
      nickname: row.nickname,
      is_primary: row.is_primary,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  },
};