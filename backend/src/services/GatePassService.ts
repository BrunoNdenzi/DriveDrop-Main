/**
 * Gate Pass Service
 * 
 * Manages facility access control for vehicle pickup and delivery.
 * 
 * Features:
 * - QR code generation for gate passes
 * - Facility access validation
 * - Time-based validity (valid_from, valid_until)
 * - Usage tracking (entry/exit times)
 * - Driver verification
 * - Integration with BOL system
 * 
 * Use Cases:
 * - Auction house pickup authorization
 * - Dealership delivery access
 * - Secure facility entry/exit tracking
 * - Driver identity verification
 */

import { createClient } from '@supabase/supabase-js';
// import QRCode from 'qrcode'; // TODO: Install qrcode package
import { FEATURE_FLAGS } from '../config/features';

// Initialize Supabase client
const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_SERVICE_KEY'] || ''
);

export interface GatePassData {
  bol_id: string;
  pass_type: 'pickup' | 'delivery';
  facility_name: string;
  facility_address: string;
  driver_id: string;
  driver_name: string;
  driver_license?: string;
  vehicle_info: string;
  valid_from: string;
  valid_until: string;
  special_instructions?: string;
  required_documents?: string[];
}

export interface GatePassUsage {
  gate_pass_id: string;
  action: 'entry' | 'exit';
  timestamp: string;
  verified_by?: string;
  notes?: string;
}

export class GatePassService {
  /**
   * Generate unique pass code
   */
  private generatePassCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `GP-${timestamp}-${random}`;
  }

  /**
   * Create new gate pass
   */
  async createGatePass(passData: GatePassData): Promise<{
    success: boolean;
    gatePass?: any;
    qrCode?: string;
    error?: string;
  }> {
    // Check feature flag
    if (!FEATURE_FLAGS.GATE_PASS_SYSTEM) {
      return {
        success: false,
        error: 'Gate pass system feature is not enabled',
      };
    }

    try {
      // Generate pass code
      const passCode = this.generatePassCode();

      // Create gate pass record
      const { data: gatePass, error } = await supabase
        .from('gate_passes')
        .insert({
          ...passData,
          pass_code: passCode,
          status: 'active',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Generate QR code
      const qrCode = await this.generateQRCode(gatePass.id, passCode);

      return {
        success: true,
        gatePass,
        qrCode,
      };
    } catch (error: any) {
      console.error('Error creating gate pass:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate QR code for gate pass
   */
  async generateQRCode(gatePassId: string, passCode: string): Promise<string> {
    // TODO: Implement after installing qrcode package
    /*
    try {
      const qrData = JSON.stringify({
        id: gatePassId,
        code: passCode,
        type: 'DRIVEDROP_GATE_PASS',
        timestamp: Date.now(),
      });

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 1,
      });

      return qrCodeDataURL;
    } catch (error: any) {
      console.error('Error generating QR code:', error);
      throw error;
    }
    */

    // Placeholder until package is installed
    return `data:text/plain;base64,${Buffer.from(`GP:${gatePassId}:${passCode}`).toString('base64')}`;
  }

  /**
   * Get gate pass by ID
   */
  async getGatePass(gatePassId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('gate_passes')
      .select('*')
      .eq('id', gatePassId)
      .single();

    if (error) {
      console.error('Error fetching gate pass:', error);
      return null;
    }

    return data;
  }

  /**
   * Get gate pass by pass code
   */
  async getGatePassByCode(passCode: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('gate_passes')
      .select('*')
      .eq('pass_code', passCode)
      .single();

    if (error) {
      console.error('Error fetching gate pass by code:', error);
      return null;
    }

    return data;
  }

  /**
   * Validate gate pass (check if currently valid)
   */
  async validateGatePass(passCode: string): Promise<{
    valid: boolean;
    gatePass?: any;
    reason?: string;
  }> {
    try {
      const gatePass = await this.getGatePassByCode(passCode);

      if (!gatePass) {
        return {
          valid: false,
          reason: 'Gate pass not found',
        };
      }

      // Check if cancelled
      if (gatePass.status === 'cancelled') {
        return {
          valid: false,
          gatePass,
          reason: 'Gate pass has been cancelled',
        };
      }

      // Check if used
      if (gatePass.status === 'used') {
        return {
          valid: false,
          gatePass,
          reason: 'Gate pass has already been used',
        };
      }

      // Check if expired
      if (gatePass.status === 'expired') {
        return {
          valid: false,
          gatePass,
          reason: 'Gate pass has expired',
        };
      }

      // Check time validity
      const now = new Date();
      const validFrom = new Date(gatePass.valid_from);
      const validUntil = new Date(gatePass.valid_until);

      if (now < validFrom) {
        return {
          valid: false,
          gatePass,
          reason: `Gate pass is not yet valid (valid from ${validFrom.toLocaleString()})`,
        };
      }

      if (now > validUntil) {
        // Auto-expire
        await this.updateStatus(gatePass.id, 'expired');
        return {
          valid: false,
          gatePass,
          reason: `Gate pass has expired (valid until ${validUntil.toLocaleString()})`,
        };
      }

      return {
        valid: true,
        gatePass,
      };
    } catch (error: any) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Record gate pass usage (entry or exit)
   */
  async recordUsage(usage: GatePassUsage): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get gate pass
      const gatePass = await this.getGatePass(usage.gate_pass_id);
      if (!gatePass) {
        throw new Error('Gate pass not found');
      }

      // Validate before recording
      const validation = await this.validateGatePass(gatePass.pass_code);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      // Get existing usage history
      const usageHistory = gatePass.usage_history || [];

      // Add new usage entry
      usageHistory.push({
        action: usage.action,
        timestamp: usage.timestamp,
        verified_by: usage.verified_by,
        notes: usage.notes,
      });

      // Update gate pass
      await supabase
        .from('gate_passes')
        .update({
          usage_history: usageHistory,
          last_used_at: usage.timestamp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', usage.gate_pass_id);

      // If this is an exit after entry, mark as used
      const hasEntry = usageHistory.some((u: any) => u.action === 'entry');
      const hasExit = usageHistory.some((u: any) => u.action === 'exit');

      if (hasEntry && hasExit && gatePass.pass_type === 'pickup') {
        await this.updateStatus(usage.gate_pass_id, 'used');
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update gate pass status
   */
  async updateStatus(
    gatePassId: string,
    status: 'active' | 'used' | 'expired' | 'cancelled'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await supabase
        .from('gate_passes')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gatePassId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel gate pass
   */
  async cancelGatePass(gatePassId: string, reason?: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await supabase
        .from('gate_passes')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', gatePassId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * List gate passes with filters
   */
  async listGatePasses(filters: {
    bol_id?: string;
    driver_id?: string;
    facility_name?: string;
    status?: string;
    pass_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ gatePasses: any[]; count: number }> {
    let query = supabase
      .from('gate_passes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.bol_id) {
      query = query.eq('bol_id', filters.bol_id);
    }

    if (filters.driver_id) {
      query = query.eq('driver_id', filters.driver_id);
    }

    if (filters.facility_name) {
      query = query.ilike('facility_name', `%${filters.facility_name}%`);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.pass_type) {
      query = query.eq('pass_type', filters.pass_type);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error listing gate passes:', error);
      return { gatePasses: [], count: 0 };
    }

    return {
      gatePasses: data || [],
      count: count || 0,
    };
  }

  /**
   * Get gate pass statistics
   */
  async getStatistics(facilityName?: string): Promise<{
    total: number;
    active: number;
    used: number;
    expired: number;
    cancelled: number;
  }> {
    let query = supabase
      .from('gate_passes')
      .select('status');

    if (facilityName) {
      query = query.eq('facility_name', facilityName);
    }

    const { data } = await query;

    if (!data) {
      return { total: 0, active: 0, used: 0, expired: 0, cancelled: 0 };
    }

    return {
      total: data.length,
      active: data.filter((gp: any) => gp.status === 'active').length,
      used: data.filter((gp: any) => gp.status === 'used').length,
      expired: data.filter((gp: any) => gp.status === 'expired').length,
      cancelled: data.filter((gp: any) => gp.status === 'cancelled').length,
    };
  }

  /**
   * Extend gate pass validity
   */
  async extendValidity(
    gatePassId: string,
    newValidUntil: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const gatePass = await this.getGatePass(gatePassId);
      if (!gatePass) {
        throw new Error('Gate pass not found');
      }

      // Check if already used or cancelled
      if (gatePass.status === 'used' || gatePass.status === 'cancelled') {
        throw new Error(`Cannot extend ${gatePass.status} gate pass`);
      }

      await supabase
        .from('gate_passes')
        .update({
          valid_until: newValidUntil,
          status: 'active', // Reactivate if expired
          updated_at: new Date().toISOString(),
        })
        .eq('id', gatePassId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default GatePassService;
