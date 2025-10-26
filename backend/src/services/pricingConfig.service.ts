/**
 * Pricing Configuration Service
 * Manages dynamic pricing configuration that can be adjusted by admins
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import { createError } from '@utils/error';

export interface PricingConfig {
  id: string;
  min_quote: number;
  accident_min_quote: number;
  min_miles: number;
  base_fuel_price: number;
  current_fuel_price: number;
  fuel_adjustment_per_dollar: number;
  surge_multiplier: number;
  surge_enabled: boolean;
  surge_reason?: string;
  expedited_multiplier: number;
  standard_multiplier: number;
  flexible_multiplier: number;
  short_distance_max: number;
  mid_distance_max: number;
  bulk_discount_enabled: boolean;
  expedited_service_enabled: boolean;
  flexible_service_enabled: boolean;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
  notes?: string;
}

export interface PricingConfigHistory {
  id: string;
  config_id: string;
  config_snapshot: any;
  changed_by?: string;
  change_reason?: string;
  changed_at: string;
  changed_fields: string[];
}

export interface UpdatePricingConfigInput {
  min_quote?: number;
  accident_min_quote?: number;
  min_miles?: number;
  base_fuel_price?: number;
  current_fuel_price?: number;
  fuel_adjustment_per_dollar?: number;
  surge_multiplier?: number;
  surge_enabled?: boolean;
  surge_reason?: string;
  expedited_multiplier?: number;
  standard_multiplier?: number;
  flexible_multiplier?: number;
  short_distance_max?: number;
  mid_distance_max?: number;
  bulk_discount_enabled?: boolean;
  expedited_service_enabled?: boolean;
  flexible_service_enabled?: boolean;
  notes?: string;
}

class PricingConfigService {
  private cachedConfig: PricingConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the active pricing configuration
   * Uses caching to reduce database calls
   */
  async getActiveConfig(): Promise<PricingConfig> {
    try {
      // Check cache
      const now = Date.now();
      if (this.cachedConfig && (now - this.cacheTimestamp) < this.CACHE_TTL) {
        logger.debug('Returning cached pricing config');
        return this.cachedConfig;
      }

      // Fetch from database
      const { data, error } = await supabaseAdmin
        .from('pricing_config')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        logger.error('Error fetching active pricing config', { error });
        // Return hardcoded defaults if database fails
        return this.getDefaultConfig();
      }

      if (!data) {
        logger.warn('No active pricing config found, using defaults');
        return this.getDefaultConfig();
      }

      // Update cache
      this.cachedConfig = data;
      this.cacheTimestamp = now;
      
      logger.debug('Fetched active pricing config from database');
      return data;
    } catch (error) {
      logger.error('Error in getActiveConfig', { error });
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration (fallback if database is unavailable)
   */
  private getDefaultConfig(): PricingConfig {
    return {
      id: 'default',
      min_quote: 150.00,
      accident_min_quote: 80.00,
      min_miles: 100,
      base_fuel_price: 3.70,
      current_fuel_price: 3.70,
      fuel_adjustment_per_dollar: 5.00,
      surge_multiplier: 1.00,
      surge_enabled: false,
      expedited_multiplier: 1.25,
      standard_multiplier: 1.00,
      flexible_multiplier: 0.95,
      short_distance_max: 500,
      mid_distance_max: 1500,
      bulk_discount_enabled: true,
      expedited_service_enabled: true,
      flexible_service_enabled: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: 'Default hardcoded configuration'
    };
  }

  /**
   * Get all pricing configurations (admin only)
   */
  async getAllConfigs(): Promise<PricingConfig[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('pricing_config')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching all pricing configs', { error });
      throw createError('Failed to fetch pricing configurations', 500, 'FETCH_ERROR');
    }
  }

  /**
   * Update pricing configuration (admin only)
   */
  async updateConfig(
    configId: string,
    updates: UpdatePricingConfigInput,
    userId: string,
    changeReason?: string
  ): Promise<PricingConfig> {
    try {
      // Validate inputs
      this.validateConfigUpdates(updates);

      // Update the configuration
      const { data, error } = await supabaseAdmin
        .from('pricing_config')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          updated_by: userId,
          change_reason: changeReason || 'No reason provided',
        })
        .eq('id', configId)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw createError('Pricing configuration not found', 404, 'NOT_FOUND');
      }

      // Clear cache to force refresh
      this.clearCache();

      logger.info('Pricing configuration updated', {
        configId,
        userId,
        changeReason,
        changes: Object.keys(updates)
      });

      return data;
    } catch (error) {
      logger.error('Error updating pricing config', { error, configId });
      throw error;
    }
  }

  /**
   * Create new pricing configuration (admin only)
   */
  async createConfig(
    config: UpdatePricingConfigInput,
    userId: string,
    setAsActive: boolean = false
  ): Promise<PricingConfig> {
    try {
      // Validate inputs
      this.validateConfigUpdates(config);

      // If setting as active, deactivate all other configs
      if (setAsActive) {
        await supabaseAdmin
          .from('pricing_config')
          .update({ is_active: false })
          .eq('is_active', true);
      }

      // Create new configuration
      const { data, error } = await supabaseAdmin
        .from('pricing_config')
        .insert({
          ...config,
          is_active: setAsActive,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      // Clear cache if this is the new active config
      if (setAsActive) {
        this.clearCache();
      }

      logger.info('New pricing configuration created', {
        configId: data.id,
        userId,
        isActive: setAsActive
      });

      return data;
    } catch (error) {
      logger.error('Error creating pricing config', { error });
      throw createError('Failed to create pricing configuration', 500, 'CREATE_ERROR');
    }
  }

  /**
   * Set a configuration as active (admin only)
   */
  async setActiveConfig(configId: string, userId: string): Promise<PricingConfig> {
    try {
      // Deactivate all configs
      await supabaseAdmin
        .from('pricing_config')
        .update({ is_active: false })
        .eq('is_active', true);

      // Activate the selected config
      const { data, error } = await supabaseAdmin
        .from('pricing_config')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('id', configId)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw createError('Pricing configuration not found', 404, 'NOT_FOUND');
      }

      // Clear cache
      this.clearCache();

      logger.info('Pricing configuration set as active', { configId, userId });

      return data;
    } catch (error) {
      logger.error('Error setting active config', { error, configId });
      throw error;
    }
  }

  /**
   * Get pricing configuration history (admin only)
   */
  async getConfigHistory(configId?: string, limit: number = 50): Promise<PricingConfigHistory[]> {
    try {
      let query = supabaseAdmin
        .from('pricing_config_history')
        .select(`
          *,
          changed_by_profile:profiles!pricing_config_history_changed_by_fkey(first_name, last_name, email)
        `)
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (configId) {
        query = query.eq('config_id', configId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching pricing config history', { error });
      throw createError('Failed to fetch pricing configuration history', 500, 'FETCH_ERROR');
    }
  }

  /**
   * Validate configuration updates
   */
  private validateConfigUpdates(updates: UpdatePricingConfigInput): void {
    // Validate min_quote
    if (updates.min_quote !== undefined && updates.min_quote < 0) {
      throw createError('Minimum quote must be positive', 400, 'INVALID_INPUT');
    }

    // Validate multipliers
    if (updates.surge_multiplier !== undefined && (updates.surge_multiplier < 0 || updates.surge_multiplier > 10)) {
      throw createError('Surge multiplier must be between 0 and 10', 400, 'INVALID_INPUT');
    }

    if (updates.expedited_multiplier !== undefined && (updates.expedited_multiplier < 0 || updates.expedited_multiplier > 5)) {
      throw createError('Expedited multiplier must be between 0 and 5', 400, 'INVALID_INPUT');
    }

    if (updates.flexible_multiplier !== undefined && (updates.flexible_multiplier < 0 || updates.flexible_multiplier > 2)) {
      throw createError('Flexible multiplier must be between 0 and 2', 400, 'INVALID_INPUT');
    }

    // Validate fuel prices
    if (updates.current_fuel_price !== undefined && updates.current_fuel_price < 0) {
      throw createError('Fuel price must be positive', 400, 'INVALID_INPUT');
    }

    // Validate distance thresholds
    if (updates.short_distance_max !== undefined && updates.short_distance_max < 0) {
      throw createError('Distance thresholds must be positive', 400, 'INVALID_INPUT');
    }
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
    logger.debug('Pricing config cache cleared');
  }
}

export const pricingConfigService = new PricingConfigService();
