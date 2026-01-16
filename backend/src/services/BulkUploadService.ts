/**
 * Bulk Upload Service
 * Process CSV uploads for creating multiple shipments at once
 */
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
);

interface BulkUploadRow {
  pickup_address: string;
  delivery_address: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_vin?: string;
  pickup_date?: string;
  delivery_date?: string;
  is_operable?: boolean;
  special_instructions?: string;
  [key: string]: any;
}

interface BulkUploadResult {
  uploadId: string;
  totalRows: number;
  status: string;
}

interface BulkUploadStatus {
  id: string;
  file_name: string;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: any[];
  status: string;
  progress_percent: number;
  created_shipment_ids: string[];
}

export class BulkUploadService {
  // private nlService: NaturalLanguageShipmentService;

  constructor() {
    // this.nlService = new NaturalLanguageShipmentService();
  }

  /**
   * Process bulk CSV upload
   */
  async processBulkUpload(
    fileBuffer: Buffer,
    fileName: string,
    userId: string
  ): Promise<BulkUploadResult> {
    // Parse CSV
    const csvText = fileBuffer.toString('utf-8');
    
    let rows: BulkUploadRow[];
    try {
      rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseError: any) {
      throw new Error(`CSV parsing failed: ${parseError.message}`);
    }

    const totalRows = rows.length;

    // Create upload record
    const { data: upload, error } = await supabase
      .from('bulk_uploads')
      .insert({
        uploaded_by: userId,
        file_name: fileName,
        file_size: fileBuffer.length,
        file_type: 'text/csv',
        total_rows: totalRows,
        status: 'pending',
        options: {},
      })
      .select()
      .single();

    if (error || !upload) {
      throw new Error(`Failed to create upload record: ${error?.message}`);
    }

    // Process asynchronously
    this.processRowsAsync(upload.id, rows, userId);

    return {
      uploadId: upload.id,
      totalRows,
      status: 'pending',
    };
  }

  /**
   * Process CSV rows asynchronously
   */
  private async processRowsAsync(
    uploadId: string,
    rows: BulkUploadRow[],
    userId: string
  ): Promise<void> {
    try {
      // Update status to processing
      await supabase
        .from('bulk_uploads')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          current_step: 'Creating shipments',
        })
        .eq('id', uploadId);

      const createdShipmentIds: string[] = [];
      const errors: any[] = [];
      let processedRows = 0;
      let successfulRows = 0;
      let failedRows = 0;

      // Process each row
      for (const row of rows) {
        processedRows++;

        try {
          // Validate required fields
          const validation = this.validateRow(row);
          if (!validation.valid) {
            errors.push({
              row: processedRows,
              errors: validation.errors,
              data: row,
            });
            failedRows++;
            continue;
          }

          // Create shipment
          const { data: shipment, error: shipmentError } = await supabase
            .from('shipments')
            .insert({
              client_id: userId,
              title: `${row.vehicle_year} ${row.vehicle_make} ${row.vehicle_model}`,
              pickup_address: row.pickup_address,
              delivery_address: row.delivery_address,
              vehicle_year: row.vehicle_year,
              vehicle_make: row.vehicle_make,
              vehicle_model: row.vehicle_model,
              vehicle_vin: row.vehicle_vin,
              pickup_date: row.pickup_date ? new Date(row.pickup_date) : null,
              delivery_date: row.delivery_date ? new Date(row.delivery_date) : null,
              is_operable: row.is_operable !== false, // Default to true
              description: row.special_instructions,
              status: 'pending',
              payment_status: 'pending',
              estimated_price: 0, // Will be calculated
            })
            .select()
            .single();

          if (shipmentError || !shipment) {
            errors.push({
              row: processedRows,
              error: shipmentError?.message || 'Unknown error',
              data: row,
            });
            failedRows++;
          } else {
            createdShipmentIds.push(shipment.id);
            successfulRows++;
          }
        } catch (rowError: any) {
          errors.push({
            row: processedRows,
            error: rowError.message,
            data: row,
          });
          failedRows++;
        }

        // Update progress
        const progressPercent = Math.round((processedRows / rows.length) * 100);
        await supabase
          .from('bulk_uploads')
          .update({
            processed_rows: processedRows,
            successful_rows: successfulRows,
            failed_rows: failedRows,
            progress_percent: progressPercent,
            created_shipment_ids: createdShipmentIds,
            errors: errors,
          })
          .eq('id', uploadId);
      }

      // Mark as completed
      await supabase
        .from('bulk_uploads')
        .update({
          status: failedRows === 0 ? 'completed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', uploadId);
    } catch (error: any) {
      // Mark as failed
      await supabase
        .from('bulk_uploads')
        .update({
          status: 'failed',
          errors: [{ message: error.message, stack: error.stack }],
        })
        .eq('id', uploadId);
    }
  }

  /**
   * Validate a CSV row
   */
  private validateRow(row: BulkUploadRow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!row.pickup_address) errors.push('Missing pickup_address');
    if (!row.delivery_address) errors.push('Missing delivery_address');
    if (!row.vehicle_year) errors.push('Missing vehicle_year');
    if (!row.vehicle_make) errors.push('Missing vehicle_make');
    if (!row.vehicle_model) errors.push('Missing vehicle_model');

    // Validate year
    if (row.vehicle_year) {
      const year = parseInt(String(row.vehicle_year));
      if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 2) {
        errors.push(`Invalid vehicle_year: ${row.vehicle_year}`);
      }
    }

    // Validate dates
    if (row.pickup_date && isNaN(Date.parse(row.pickup_date))) {
      errors.push(`Invalid pickup_date: ${row.pickup_date}`);
    }
    if (row.delivery_date && isNaN(Date.parse(row.delivery_date))) {
      errors.push(`Invalid delivery_date: ${row.delivery_date}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string): Promise<BulkUploadStatus | null> {
    const { data, error } = await supabase
      .from('bulk_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as BulkUploadStatus;
  }

  /**
   * Get all uploads for a user
   */
  async getUserUploads(userId: string): Promise<BulkUploadStatus[]> {
    const { data, error } = await supabase
      .from('bulk_uploads')
      .select('*')
      .eq('uploaded_by', userId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data as BulkUploadStatus[];
  }

  /**
   * Cancel an upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    await supabase
      .from('bulk_uploads')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', uploadId);
  }
}
