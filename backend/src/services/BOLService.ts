/**
 * Bill of Lading (BOL) Service
 * 
 * Manages legal transport documents required for commercial vehicle shipping.
 * 
 * Features:
 * - BOL generation and management
 * - PDF generation for printable BOLs
 * - Digital signature capture
 * - Vehicle condition documentation
 * - Damage reporting
 * - Document compliance tracking
 * 
 * Legal Requirements:
 * - BOL is required by law for commercial transport (49 CFR Part 373)
 * - Must include shipper, consignee, carrier information
 * - Must document vehicle condition at pickup and delivery
 * - Signatures required from all parties
 */

import { createClient } from '@supabase/supabase-js';
// @ts-ignore - Used when generatePDF() method is called
import PDFDocument from 'pdfkit';
import { FEATURE_FLAGS } from '../config/features';

// Initialize Supabase client
const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
);

export interface BOLData {
  shipment_id: string;
  bol_number?: string;
  shipper_name: string;
  shipper_address: string;
  shipper_phone?: string;
  shipper_email?: string;
  consignee_name: string;
  consignee_address: string;
  consignee_phone?: string;
  consignee_email?: string;
  carrier_name: string;
  carrier_dot_number?: string;
  carrier_mc_number?: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_vin: string;
  vehicle_color?: string;
  vehicle_mileage?: number;
  vehicle_license_plate?: string;
  vehicle_title_status?: string;
  vehicle_keys_location?: string;
  pickup_date?: string;
  delivery_date?: string;
  special_instructions?: string;
  declared_value?: number;
}

export interface VehicleCondition {
  bol_id: string;
  inspection_type: 'pickup' | 'delivery';
  inspector_name: string;
  inspector_signature?: string;
  condition_notes?: string;
  damage_report?: DamageItem[];
  photos?: string[];
  inspection_date: string;
}

export interface DamageItem {
  location: string;
  type: 'scratch' | 'dent' | 'crack' | 'broken' | 'missing' | 'other';
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  photo_url?: string;
}

export interface SignatureData {
  bol_id: string;
  signer_type: 'shipper' | 'driver' | 'consignee';
  signer_name: string;
  signature_data: string; // Base64 encoded signature image
  signed_at: string;
}

export class BOLService {
  /**
   * Generate BOL number (unique identifier)
   */
  private generateBOLNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `BOL-${year}${month}${day}-${random}`;
  }

  /**
   * Create new Bill of Lading
   */
  async createBOL(bolData: BOLData): Promise<{ success: boolean; bol: any; error?: string }> {
    // Check feature flag
    if (!FEATURE_FLAGS.BOL_SYSTEM) {
      return {
        success: false,
        bol: null,
        error: 'BOL system feature is not enabled',
      };
    }

    try {
      // Generate BOL number if not provided
      const bolNumber = bolData.bol_number || this.generateBOLNumber();

      // Create BOL record
      const { data: bol, error } = await supabase
        .from('bills_of_lading')
        .insert({
          ...bolData,
          bol_number: bolNumber,
          status: 'draft',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update shipment with BOL reference
      await supabase
        .from('broker_shipments')
        .update({ bol_id: bol.id })
        .eq('id', bolData.shipment_id);

      return {
        success: true,
        bol,
      };
    } catch (error: any) {
      console.error('Error creating BOL:', error);
      return {
        success: false,
        bol: null,
        error: error.message,
      };
    }
  }

  /**
   * Get BOL by ID
   */
  async getBOL(bolId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('bills_of_lading')
      .select('*')
      .eq('id', bolId)
      .single();

    if (error) {
      console.error('Error fetching BOL:', error);
      return null;
    }

    return data;
  }

  /**
   * Get BOL by shipment ID
   */
  async getBOLByShipment(shipmentId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('bills_of_lading')
      .select('*')
      .eq('shipment_id', shipmentId)
      .single();

    if (error) {
      console.error('Error fetching BOL by shipment:', error);
      return null;
    }

    return data;
  }

  /**
   * Update BOL
   */
  async updateBOL(bolId: string, updates: Partial<BOLData>): Promise<{ success: boolean; bol?: any; error?: string }> {
    try {
      const { data: bol, error } = await supabase
        .from('bills_of_lading')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bolId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        bol,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Record vehicle condition at pickup or delivery
   */
  async recordCondition(condition: VehicleCondition): Promise<{ success: boolean; error?: string }> {
    try {
      // Get existing BOL
      const bol = await this.getBOL(condition.bol_id);
      if (!bol) {
        throw new Error('BOL not found');
      }

      // Update condition field based on inspection type
      const fieldName = condition.inspection_type === 'pickup' 
        ? 'pickup_condition' 
        : 'delivery_condition';

      await supabase
        .from('bills_of_lading')
        .update({
          [fieldName]: {
            inspector_name: condition.inspector_name,
            inspector_signature: condition.inspector_signature,
            condition_notes: condition.condition_notes,
            damage_report: condition.damage_report,
            photos: condition.photos,
            inspection_date: condition.inspection_date,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', condition.bol_id);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Add signature to BOL
   */
  async addSignature(signature: SignatureData): Promise<{ success: boolean; error?: string }> {
    try {
      // Get existing BOL
      const bol = await this.getBOL(signature.bol_id);
      if (!bol) {
        throw new Error('BOL not found');
      }

      // Determine which signature field to update
      let updateField: string;
      switch (signature.signer_type) {
        case 'shipper':
          updateField = 'shipper_signature';
          break;
        case 'driver':
          updateField = 'driver_signature';
          break;
        case 'consignee':
          updateField = 'consignee_signature';
          break;
        default:
          throw new Error('Invalid signer type');
      }

      // Update signature
      await supabase
        .from('bills_of_lading')
        .update({
          [updateField]: signature.signature_data,
          [`${signature.signer_type}_signed_at`]: signature.signed_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', signature.bol_id);

      // Check if all signatures are complete
      const updatedBOL = await this.getBOL(signature.bol_id);
      const allSigned = updatedBOL.shipper_signature && 
                       updatedBOL.driver_signature && 
                       updatedBOL.consignee_signature;

      // Update status if all signed
      if (allSigned && updatedBOL.status === 'in_transit') {
        await supabase
          .from('bills_of_lading')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', signature.bol_id);
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
   * Update BOL status
   */
  async updateStatus(
    bolId: string, 
    status: 'draft' | 'issued' | 'in_transit' | 'delivered' | 'completed' | 'cancelled'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Set timestamps based on status
      if (status === 'issued' && !updates.issued_at) {
        updates.issued_at = new Date().toISOString();
      }
      if (status === 'delivered' && !updates.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }
      if (status === 'completed' && !updates.completed_at) {
        updates.completed_at = new Date().toISOString();
      }

      await supabase
        .from('bills_of_lading')
        .update(updates)
        .eq('id', bolId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate PDF for BOL
   * TODO: Implement after installing pdfkit package
   */
  async generatePDF(bolId: string): Promise<{ success: boolean; pdf?: Buffer; error?: string }> {
    try {
      // Get BOL data
      const bol = await this.getBOL(bolId);
      if (!bol) {
        throw new Error('BOL not found');
      }

      // TODO: Generate PDF using pdfkit
      // For now, return placeholder
      return {
        success: false,
        error: 'PDF generation requires pdfkit package to be installed',
      };

      /*
      // Create PDF document
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      
      return new Promise((resolve) => {
        doc.on('end', () => {
          resolve({
            success: true,
            pdf: Buffer.concat(chunks),
          });
        });

        // Header
        doc.fontSize(20).text('BILL OF LADING', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`BOL Number: ${bol.bol_number}`);
        doc.text(`Date: ${new Date(bol.created_at).toLocaleDateString()}`);
        doc.moveDown();

        // Shipper Information
        doc.fontSize(14).text('Shipper Information', { underline: true });
        doc.fontSize(10);
        doc.text(`Name: ${bol.shipper_name}`);
        doc.text(`Address: ${bol.shipper_address}`);
        if (bol.shipper_phone) doc.text(`Phone: ${bol.shipper_phone}`);
        if (bol.shipper_email) doc.text(`Email: ${bol.shipper_email}`);
        doc.moveDown();

        // Consignee Information
        doc.fontSize(14).text('Consignee Information', { underline: true });
        doc.fontSize(10);
        doc.text(`Name: ${bol.consignee_name}`);
        doc.text(`Address: ${bol.consignee_address}`);
        if (bol.consignee_phone) doc.text(`Phone: ${bol.consignee_phone}`);
        if (bol.consignee_email) doc.text(`Email: ${bol.consignee_email}`);
        doc.moveDown();

        // Carrier Information
        doc.fontSize(14).text('Carrier Information', { underline: true });
        doc.fontSize(10);
        doc.text(`Name: ${bol.carrier_name}`);
        if (bol.carrier_dot_number) doc.text(`DOT Number: ${bol.carrier_dot_number}`);
        if (bol.carrier_mc_number) doc.text(`MC Number: ${bol.carrier_mc_number}`);
        doc.moveDown();

        // Vehicle Information
        doc.fontSize(14).text('Vehicle Information', { underline: true });
        doc.fontSize(10);
        doc.text(`Year: ${bol.vehicle_year}`);
        doc.text(`Make: ${bol.vehicle_make}`);
        doc.text(`Model: ${bol.vehicle_model}`);
        doc.text(`VIN: ${bol.vehicle_vin}`);
        if (bol.vehicle_color) doc.text(`Color: ${bol.vehicle_color}`);
        if (bol.vehicle_mileage) doc.text(`Mileage: ${bol.vehicle_mileage}`);
        if (bol.vehicle_license_plate) doc.text(`License Plate: ${bol.vehicle_license_plate}`);
        doc.moveDown();

        // Signatures section
        doc.addPage();
        doc.fontSize(14).text('Signatures', { underline: true });
        doc.moveDown();

        // Shipper signature
        doc.fontSize(10).text('Shipper Signature:');
        if (bol.shipper_signature) {
          // Add signature image
          doc.image(Buffer.from(bol.shipper_signature, 'base64'), { width: 200 });
        }
        doc.moveDown(2);

        // Driver signature
        doc.text('Driver Signature:');
        if (bol.driver_signature) {
          doc.image(Buffer.from(bol.driver_signature, 'base64'), { width: 200 });
        }
        doc.moveDown(2);

        // Consignee signature
        doc.text('Consignee Signature:');
        if (bol.consignee_signature) {
          doc.image(Buffer.from(bol.consignee_signature, 'base64'), { width: 200 });
        }

        doc.end();
      });
      */
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all BOLs with filters
   */
  async listBOLs(filters: {
    status?: string;
    commercial_account_id?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ bols: any[]; count: number }> {
    let query = supabase
      .from('bills_of_lading')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.commercial_account_id) {
      query = query.eq('commercial_account_id', filters.commercial_account_id);
    }

    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error listing BOLs:', error);
      return { bols: [], count: 0 };
    }

    return {
      bols: data || [],
      count: count || 0,
    };
  }

  /**
   * Check if BOL is complete (all signatures collected)
   */
  async isComplete(bolId: string): Promise<boolean> {
    const bol = await this.getBOL(bolId);
    if (!bol) return false;

    return !!(bol.shipper_signature && bol.driver_signature && bol.consignee_signature);
  }

  /**
   * Validate BOL data completeness
   */
  validateBOLData(bolData: Partial<BOLData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!bolData.shipment_id) errors.push('shipment_id is required');
    if (!bolData.shipper_name) errors.push('shipper_name is required');
    if (!bolData.shipper_address) errors.push('shipper_address is required');
    if (!bolData.consignee_name) errors.push('consignee_name is required');
    if (!bolData.consignee_address) errors.push('consignee_address is required');
    if (!bolData.carrier_name) errors.push('carrier_name is required');
    if (!bolData.vehicle_year) errors.push('vehicle_year is required');
    if (!bolData.vehicle_make) errors.push('vehicle_make is required');
    if (!bolData.vehicle_model) errors.push('vehicle_model is required');
    if (!bolData.vehicle_vin) errors.push('vehicle_vin is required');

    // VIN validation (17 characters)
    if (bolData.vehicle_vin && bolData.vehicle_vin.length !== 17) {
      errors.push('vehicle_vin must be exactly 17 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default BOLService;
