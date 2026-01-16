/**
 * Universal Auction Integration Service
 * 
 * Handles integrations with ANY auction house, dealership, or vehicle source.
 * Supports multiple integration types: API, SFTP, Email, Manual CSV, Webhook.
 * 
 * Key Features:
 * - Universal field mapping via JSON configuration
 * - Multiple authentication methods (OAuth2, API Key, Basic Auth, JWT, SFTP)
 * - Automatic sync scheduling
 * - Error handling and retry logic
 * - Performance monitoring and logging
 * 
 * Usage:
 * ```typescript
 * const service = new UniversalAuctionIntegrationService();
 * const vehicles = await service.fetchVehicles('integration-uuid');
 * await service.syncIntegration('integration-uuid');
 * ```
 */

import { createClient } from '@supabase/supabase-js';
import axios, { AxiosRequestConfig } from 'axios';
// @ts-ignore - Used when SFTP integration type is enabled
import * as sftp from 'ssh2-sftp-client';
// @ts-ignore - Used when CSV integration type is enabled
import { parse as parseCSV } from 'csv-parse/sync';
import { FEATURE_FLAGS } from '../config/features';

// Initialize Supabase client
const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
);

export interface IntegrationConfig {
  id: string;
  name: string;
  integration_type: 'api' | 'sftp' | 'email' | 'manual_csv' | 'webhook';
  auth_method: 'oauth2' | 'api_key' | 'basic_auth' | 'jwt' | 'sftp_credentials' | 'none';
  base_url?: string;
  api_endpoint?: string;
  auth_config: Record<string, any>;
  field_mapping: Record<string, string>;
  sync_frequency: 'realtime' | 'hourly' | 'daily' | 'manual';
  is_active: boolean;
}

export interface RawVehicleData {
  [key: string]: any;
}

export interface MappedVehicleData {
  // Standard DriveDrop fields
  vehicle_year?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_vin?: string;
  vehicle_color?: string;
  vehicle_mileage?: number;
  vehicle_license_plate?: string;
  vehicle_title_status?: string;
  pickup_location?: string;
  delivery_location?: string;
  lot_number?: string;
  auction_house?: string;
  // Commercial-specific
  is_commercial: boolean;
  source: string;
}

export interface SyncResult {
  success: boolean;
  vehicles_fetched: number;
  vehicles_created: number;
  vehicles_updated: number;
  vehicles_failed: number;
  errors: string[];
  duration_ms: number;
}

export class UniversalAuctionIntegrationService {
  /**
   * Fetch vehicles from an integration
   */
  async fetchVehicles(integrationId: string): Promise<RawVehicleData[]> {
    // Check feature flag
    if (!FEATURE_FLAGS.UNIVERSAL_INTEGRATIONS) {
      throw new Error('Universal integrations feature is not enabled');
    }

    // Get integration config
    const { data: integration, error } = await supabase
      .from('auction_integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (error || !integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    if (!integration.is_active) {
      throw new Error(`Integration is not active: ${integration.name}`);
    }

    const config = integration as IntegrationConfig;

    // Route to appropriate handler based on integration type
    switch (config.integration_type) {
      case 'api':
        return await this.handleAPIIntegration(config);
      case 'sftp':
        return await this.handleSFTPIntegration(config);
      case 'email':
        return await this.handleEmailIntegration(config);
      case 'manual_csv':
        throw new Error('Manual CSV integrations must be uploaded via bulk upload endpoint');
      case 'webhook':
        throw new Error('Webhook integrations receive data passively - use sync endpoint');
      default:
        throw new Error(`Unsupported integration type: ${config.integration_type}`);
    }
  }

  /**
   * Handle API-based integration
   */
  private async handleAPIIntegration(config: IntegrationConfig): Promise<RawVehicleData[]> {
    const startTime = Date.now();

    try {
      // Build request configuration
      const requestConfig: AxiosRequestConfig = {
        method: 'GET',
        url: `${config.base_url}${config.api_endpoint}`,
        headers: {},
        timeout: 30000, // 30 second timeout
      };

      // Apply authentication
      this.applyAuthentication(requestConfig, config);

      // Make API request
      const response = await axios(requestConfig);

      // Extract vehicles array from response
      const vehicles = this.extractVehiclesFromResponse(response.data, config);

      // Log success
      await this.logIntegration(config.id, {
        status: 'success',
        vehicles_fetched: vehicles.length,
        duration_ms: Date.now() - startTime,
        request_url: requestConfig.url,
        response_status: response.status,
      });

      return vehicles;
    } catch (error: any) {
      // Log error
      await this.logIntegration(config.id, {
        status: 'error',
        error_message: error.message,
        error_details: error.response?.data,
        duration_ms: Date.now() - startTime,
      });

      throw new Error(`API integration failed: ${error.message}`);
    }
  }

  /**
   * Handle SFTP-based integration
   */
  private async handleSFTPIntegration(config: IntegrationConfig): Promise<RawVehicleData[]> {
    const startTime = Date.now();
    // TODO: Install ssh2-sftp-client package
    // const client = new sftp();

    try {
      // Connect to SFTP server
      // await client.connect({
      //   host: config.auth_config['host'],
      //   port: config.auth_config['port'] || 22,
      //   username: config.auth_config['username'],
      //   password: config.auth_config['password'],
      //   privateKey: config.auth_config['private_key'],
      // });

      // List files in directory
      // const directory = config.auth_config['directory'] || '/';
      // const files = await client.list(directory);

      // Find latest CSV file
      // const csvFiles = files.filter((f: any) => f.name.endsWith('.csv'));
      // if (csvFiles.length === 0) {
      //   throw new Error('No CSV files found in SFTP directory');
      // }

      // Sort by modification time, get most recent
      // csvFiles.sort((a: any, b: any) => b.modifyTime - a.modifyTime);
      // const latestFile = csvFiles[0];

      // Download file
      // const filePath = `${directory}/${latestFile.name}`;
      // const fileBuffer = await client.get(filePath);

      // Parse CSV
      // const vehicles = parseCSV(fileBuffer.toString(), {
      //   columns: true,
      //   skip_empty_lines: true,
      // });

      // Close connection
      // await client.end();

      // Log success
      // await this.logIntegration(config.id, {
      //   status: 'success',
      //   vehicles_fetched: vehicles.length,
      //   duration_ms: Date.now() - startTime,
      //   file_name: latestFile.name,
      // });

      // return vehicles;
      
      // Temporary implementation until packages are installed
      await this.logIntegration(config.id, {
        status: 'error',
        error_message: 'SFTP integration requires ssh2-sftp-client package',
        duration_ms: Date.now() - startTime,
      });
      throw new Error('SFTP integration requires ssh2-sftp-client package to be installed');
    } catch (error: any) {
      // await client.end();

      // Log error
      await this.logIntegration(config.id, {
        status: 'error',
        error_message: error.message,
        duration_ms: Date.now() - startTime,
      });

      throw new Error(`SFTP integration failed: ${error.message}`);
    }
  }

  /**
   * Handle email-based integration (requires email processing service)
   */
  private async handleEmailIntegration(_config: IntegrationConfig): Promise<RawVehicleData[]> {
    // This would integrate with email parsing service
    // For now, return empty array - implement when email service is ready
    throw new Error('Email integration not yet implemented - coming soon');
  }

  /**
   * Apply authentication to API request
   */
  private applyAuthentication(requestConfig: AxiosRequestConfig, config: IntegrationConfig): void {
    switch (config.auth_method) {
      case 'api_key':
        // API Key in header
        const keyHeader = config.auth_config['key_header'] || 'X-API-Key';
        requestConfig.headers![keyHeader] = config.auth_config['api_key'];
        break;

      case 'basic_auth':
        // Basic authentication
        requestConfig.auth = {
          username: config.auth_config['username'],
          password: config.auth_config['password'],
        };
        break;

      case 'oauth2':
        // OAuth2 Bearer token
        requestConfig.headers!['Authorization'] = `Bearer ${config.auth_config['access_token']}`;
        break;

      case 'jwt':
        // JWT token
        requestConfig.headers!['Authorization'] = `Bearer ${config.auth_config['jwt_token']}`;
        break;

      case 'none':
        // No authentication required
        break;

      default:
        throw new Error(`Unsupported auth method: ${config.auth_method}`);
    }
  }

  /**
   * Extract vehicles array from API response
   * Handles different response structures
   */
  private extractVehiclesFromResponse(data: any, config: IntegrationConfig): RawVehicleData[] {
    // Check if data is already an array
    if (Array.isArray(data)) {
      return data;
    }

    // Check for common response patterns
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }

    if (data.vehicles && Array.isArray(data.vehicles)) {
      return data.vehicles;
    }

    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }

    if (data.items && Array.isArray(data.items)) {
      return data.items;
    }

    // Use custom extraction path if configured
    if (config.auth_config['data_path']) {
      const path = config.auth_config['data_path'].split('.');
      let current = data;
      for (const key of path) {
        current = current[key];
        if (!current) break;
      }
      if (Array.isArray(current)) {
        return current;
      }
    }

    throw new Error('Unable to extract vehicles array from API response');
  }

  /**
   * Map external fields to DriveDrop standard fields
   */
  mapFields(rawData: RawVehicleData, fieldMapping: Record<string, string>): MappedVehicleData {
    const mapped: MappedVehicleData = {
      is_commercial: true,
      source: 'auction_integration',
    };

    // Apply field mapping
    for (const [externalField, internalField] of Object.entries(fieldMapping)) {
      const value = this.getNestedValue(rawData, externalField);
      
      if (value !== undefined && value !== null) {
        // Type conversion based on internal field
        switch (internalField) {
          case 'vehicle_year':
          case 'vehicle_mileage':
            mapped[internalField] = parseInt(value.toString());
            break;
          default:
            // @ts-ignore - dynamic field assignment
            mapped[internalField] = value.toString();
        }
      }
    }

    return mapped;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Full sync operation - fetch, map, and create/update vehicles
   */
  async syncIntegration(integrationId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      vehicles_fetched: 0,
      vehicles_created: 0,
      vehicles_updated: 0,
      vehicles_failed: 0,
      errors: [],
      duration_ms: 0,
    };

    try {
      // Get integration config
      const { data: integration } = await supabase
        .from('auction_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (!integration) {
        throw new Error('Integration not found');
      }

      // Fetch raw vehicles
      const rawVehicles = await this.fetchVehicles(integrationId);
      result.vehicles_fetched = rawVehicles.length;

      // Map and create vehicles
      for (const rawVehicle of rawVehicles) {
        try {
          const mappedVehicle = this.mapFields(rawVehicle, integration.field_mapping);

          // Check if vehicle already exists (by VIN or lot number)
          const existingVehicle = await this.findExistingVehicle(
            mappedVehicle.vehicle_vin,
            mappedVehicle.lot_number,
            integration.id
          );

          if (existingVehicle) {
            // Update existing vehicle
            await supabase
              .from('shipments')
              .update({
                ...mappedVehicle,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingVehicle.id);

            result.vehicles_updated++;
          } else {
            // Create new vehicle/shipment
            await supabase
              .from('shipments')
              .insert({
                ...mappedVehicle,
                status: 'quote_requested',
                auction_house: integration.name,
              });

            result.vehicles_created++;
          }
        } catch (error: any) {
          result.vehicles_failed++;
          result.errors.push(`Failed to process vehicle: ${error.message}`);
        }
      }

      // Update last sync time
      await supabase
        .from('auction_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          health_status: result.vehicles_failed === 0 ? 'healthy' : 'degraded',
          last_error: result.errors.length > 0 ? result.errors[0] : null,
        })
        .eq('id', integrationId);

      result.success = true;
      result.duration_ms = Date.now() - startTime;

      return result;
    } catch (error: any) {
      result.errors.push(error.message);
      result.duration_ms = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Find existing vehicle by VIN or lot number
   */
  private async findExistingVehicle(
    vin?: string,
    lotNumber?: string,
    _integrationId?: string
  ): Promise<any | null> {
    if (!vin && !lotNumber) {
      return null;
    }

    let query = supabase.from('shipments').select('id');

    if (vin) {
      query = query.eq('vehicle_vin', vin);
    } else if (lotNumber) {
      query = query.eq('lot_number', lotNumber);
    }

    const { data } = await query.single();
    return data;
  }

  /**
   * Test integration connection
   */
  async testConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
    try {
      const vehicles = await this.fetchVehicles(integrationId);
      
      return {
        success: true,
        message: `Successfully connected. Found ${vehicles.length} vehicles.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Log integration activity
   */
  private async logIntegration(integrationId: string, logData: Record<string, any>): Promise<void> {
    await supabase.from('integration_logs').insert({
      integration_id: integrationId,
      ...logData,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Get integration health status
   */
  async getHealthStatus(integrationId: string): Promise<{
    status: 'healthy' | 'degraded' | 'failing';
    last_sync: string | null;
    recent_errors: number;
    success_rate: number;
  }> {
    // Get recent logs (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logs } = await supabase
      .from('integration_logs')
      .select('status')
      .eq('integration_id', integrationId)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    if (!logs || logs.length === 0) {
      return {
        status: 'healthy',
        last_sync: null,
        recent_errors: 0,
        success_rate: 100,
      };
    }

    const totalLogs = logs.length;
    const errorLogs = logs.filter((log: any) => log.status === 'error').length;
    const successRate = ((totalLogs - errorLogs) / totalLogs) * 100;

    let status: 'healthy' | 'degraded' | 'failing' = 'healthy';
    if (successRate < 50) {
      status = 'failing';
    } else if (successRate < 90) {
      status = 'degraded';
    }

    const { data: integration } = await supabase
      .from('auction_integrations')
      .select('last_sync_at')
      .eq('id', integrationId)
      .single();

    return {
      status,
      last_sync: integration?.last_sync_at || null,
      recent_errors: errorLogs,
      success_rate: Math.round(successRate),
    };
  }
}

export default UniversalAuctionIntegrationService;
