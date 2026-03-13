/**
 * Lead Acquisition Service
 * Handles lead ingestion from FMCSA, CSV imports, manual entry, and lead management
 */
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';

export interface LeadInput {
  source: string;
  source_id?: string;
  lead_type: string;
  company_name: string;
  dba_name?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_title?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  usdot_number?: string;
  mc_number?: string;
  carrier_operation?: string;
  entity_type?: string;
  operating_status?: string;
  total_drivers?: number;
  total_power_units?: number;
  mcs150_date?: string;
  fleet_size?: number;
  vehicle_types?: string[];
  service_areas?: string[];
  website_url?: string;
  notes?: string;
  tags?: string[];
  raw_data?: any;
}

interface FMCSACarrier {
  dot_number: string;
  legal_name: string;
  dba_name: string;
  carrier_operation: string;
  hm_flag: string;
  pc_flag: string;
  phy_street: string;
  phy_city: string;
  phy_state: string;
  phy_zip: string;
  phy_country: string;
  mailing_street: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip: string;
  telephone: string;
  fax: string;
  email_address: string;
  mcs150_date: string;
  mcs150_mileage: string;
  mcs150_mileage_year: string;
  add_date: string;
  oic_state: string;
  nbr_power_unit: string;
  driver_total: string;
}

export class LeadAcquisitionService {
  
  /**
   * Search FMCSA public data (SAFER system)
   * Uses the publicly available FMCSA Web API
   */
  async searchFMCSA(params: {
    state?: string | undefined;
    city?: string | undefined;
    carrierOperation?: string | undefined;
    entityType?: string | undefined;
    page?: number | undefined;
    size?: number | undefined;
  }): Promise<{ carriers: FMCSACarrier[]; totalCount: number }> {
    const { state, city, carrierOperation, entityType, page = 1, size = 50 } = params;
    
    const webKey = process.env['FMCSA_API_KEY'];
    
    if (!webKey) {
      logger.warn('FMCSA_API_KEY not set - using mock data or limited access');
      // Without API key, we can still use the public lookup by USDOT or MC
      return { carriers: [], totalCount: 0 };
    }
    
    try {
      // FMCSA QC REST API endpoint
      // GET https://mobile.fmcsa.dot.gov/qc/services/carriers/{dotNumber}?webKey={key}
      // For state-based search, iterate or use bulk download
      
      let url = `https://mobile.fmcsa.dot.gov/qc/services/carriers?webKey=${encodeURIComponent(webKey)}`;
      
      if (state) url += `&stateAbbrev=${encodeURIComponent(state)}`;
      if (city) url += `&city=${encodeURIComponent(city)}`;
      if (carrierOperation) url += `&carrierOperation=${encodeURIComponent(carrierOperation)}`;
      if (entityType) url += `&entityType=${encodeURIComponent(entityType)}`;
      url += `&page=${page}&size=${Math.min(size, 100)}`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        logger.error(`FMCSA API error: ${response.status} ${response.statusText}`);
        return { carriers: [], totalCount: 0 };
      }
      
      const data: any = await response.json();
      
      // Parse response based on FMCSA API structure
      const carriers: FMCSACarrier[] = (data.content || []).map((item: any) => ({
        dot_number: item.dot_number?.toString() || item.dotNumber?.toString() || '',
        legal_name: item.legal_name || item.legalName || '',
        dba_name: item.dba_name || item.dbaName || '',
        carrier_operation: item.carrier_operation || item.carrierOperation?.desc || '',
        hm_flag: item.hm_flag || '',
        pc_flag: item.pc_flag || '',
        phy_street: item.phy_street || item.phyStreet || '',
        phy_city: item.phy_city || item.phyCity || '',
        phy_state: item.phy_state || item.phyState || '',
        phy_zip: item.phy_zip || item.phyZip || '',
        phy_country: item.phy_country || 'US',
        mailing_street: item.mailing_street || item.mailingStreet || '',
        mailing_city: item.mailing_city || item.mailingCity || '',
        mailing_state: item.mailing_state || item.mailingState || '',
        mailing_zip: item.mailing_zip || item.mailingZip || '',
        telephone: item.telephone || item.phone || '',
        fax: item.fax || '',
        email_address: item.email_address || item.emailAddress || '',
        mcs150_date: item.mcs150_date || item.mcs150Date || '',
        mcs150_mileage: item.mcs150_mileage || '',
        mcs150_mileage_year: item.mcs150_mileage_year || '',
        add_date: item.add_date || item.addDate || '',
        oic_state: item.oic_state || '',
        nbr_power_unit: item.nbr_power_unit?.toString() || item.totalPowerUnits?.toString() || '0',
        driver_total: item.driver_total?.toString() || item.totalDrivers?.toString() || '0',
      }));
      
      return {
        carriers,
        totalCount: data.total_count || data.totalRows || carriers.length,
      };
    } catch (error: any) {
      logger.error('FMCSA search error:', error.message);
      return { carriers: [], totalCount: 0 };
    }
  }

  /**
   * Lookup a single carrier by USDOT number from FMCSA
   */
  async lookupFMCSAByDOT(dotNumber: string): Promise<FMCSACarrier | null> {
    const webKey = process.env['FMCSA_API_KEY'];
    if (!webKey) return null;
    
    try {
      const url = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${encodeURIComponent(dotNumber)}?webKey=${encodeURIComponent(webKey)}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      
      if (!response.ok) return null;
      
      const data: any = await response.json();
      const item = data.content?.[0] || data;
      
      return {
        dot_number: item.dot_number?.toString() || dotNumber,
        legal_name: item.legal_name || item.legalName || '',
        dba_name: item.dba_name || item.dbaName || '',
        carrier_operation: item.carrier_operation || '',
        hm_flag: item.hm_flag || '',
        pc_flag: item.pc_flag || '',
        phy_street: item.phy_street || item.phyStreet || '',
        phy_city: item.phy_city || item.phyCity || '',
        phy_state: item.phy_state || item.phyState || '',
        phy_zip: item.phy_zip || item.phyZip || '',
        phy_country: item.phy_country || 'US',
        mailing_street: item.mailing_street || '',
        mailing_city: item.mailing_city || '',
        mailing_state: item.mailing_state || '',
        mailing_zip: item.mailing_zip || '',
        telephone: item.telephone || item.phone || '',
        fax: item.fax || '',
        email_address: item.email_address || item.emailAddress || '',
        mcs150_date: item.mcs150_date || '',
        mcs150_mileage: item.mcs150_mileage || '',
        mcs150_mileage_year: item.mcs150_mileage_year || '',
        add_date: item.add_date || '',
        oic_state: item.oic_state || '',
        nbr_power_unit: item.nbr_power_unit?.toString() || '0',
        driver_total: item.driver_total?.toString() || '0',
      };
    } catch (error: any) {
      logger.error(`FMCSA lookup error for DOT ${dotNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Convert FMCSA carrier record to a lead
   */
  fmcsaToLead(carrier: FMCSACarrier): LeadInput {
    // Determine lead type from carrier data
    let leadType = 'carrier';
    const op = carrier.carrier_operation?.toUpperCase() || '';
    if (op.includes('BROKER')) leadType = 'broker';
    
    const lead: LeadInput = {
      source: 'fmcsa',
      source_id: carrier.dot_number,
      lead_type: leadType,
      company_name: carrier.legal_name || carrier.dba_name || 'Unknown',
      raw_data: carrier,
    };
    if (carrier.dba_name) lead.dba_name = carrier.dba_name;
    if (carrier.telephone) lead.contact_phone = carrier.telephone;
    if (carrier.email_address) lead.contact_email = carrier.email_address;
    if (carrier.phy_street) lead.address_street = carrier.phy_street;
    if (carrier.phy_city) lead.address_city = carrier.phy_city;
    if (carrier.phy_state) lead.address_state = carrier.phy_state;
    if (carrier.phy_zip) lead.address_zip = carrier.phy_zip;
    lead.usdot_number = carrier.dot_number;
    if (carrier.carrier_operation) lead.carrier_operation = carrier.carrier_operation;
    lead.operating_status = 'AUTHORIZED';
    const drivers = parseInt(carrier.driver_total);
    if (drivers) lead.total_drivers = drivers;
    const units = parseInt(carrier.nbr_power_unit);
    if (units) { lead.total_power_units = units; lead.fleet_size = units; }
    if (carrier.mcs150_date) lead.mcs150_date = carrier.mcs150_date;
    return lead;
  }

  /**
   * Import FMCSA carriers into leads table
   */
  async importFMCSALeads(params: {
    state?: string | undefined;
    city?: string | undefined;
    entityType?: string | undefined;
    maxRecords?: number | undefined;
    createdBy?: string | undefined;
  }): Promise<{
    jobId: string;
    imported: number;
    skipped: number;
    duplicates: number;
    errors: number;
  }> {
    const { state, city, entityType, maxRecords = 100, createdBy } = params;
    
    // Create import job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('lead_import_jobs')
      .insert({
        source: 'fmcsa_api',
        status: 'processing',
        filters: { state, city, entityType, maxRecords },
        started_at: new Date().toISOString(),
        created_by: createdBy,
      })
      .select()
      .single();

    if (jobError || !job) {
      logger.error('Failed to create import job:', jobError);
      throw new Error('Failed to create import job');
    }

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let errors = 0;
    let page = 1;
    const errorList: any[] = [];

    try {
      while (imported + skipped + duplicates < maxRecords) {
        const remaining = maxRecords - (imported + skipped + duplicates);
        const pageSize = Math.min(remaining, 50);
        
        const { carriers } = await this.searchFMCSA({ 
          state, city, entityType, page, size: pageSize 
        });
        
        if (carriers.length === 0) break;

        for (const carrier of carriers) {
          try {
            const lead = this.fmcsaToLead(carrier);
            
            // Skip if no useful contact info
            if (!lead.contact_email && !lead.contact_phone) {
              skipped++;
              continue;
            }
            
            // Check for duplicate by USDOT number
            const { data: existing } = await supabaseAdmin
              .from('leads')
              .select('id')
              .eq('usdot_number', carrier.dot_number)
              .maybeSingle();

            if (existing) {
              duplicates++;
              continue;
            }

            // Insert lead
            const { error: insertError } = await supabaseAdmin
              .from('leads')
              .insert({
                ...lead,
                score: this.calculateLeadScore(lead),
                created_by: createdBy,
              });

            if (insertError) {
              errors++;
              errorList.push({ dot: carrier.dot_number, error: insertError.message });
            } else {
              imported++;
            }
          } catch (err: any) {
            errors++;
            errorList.push({ dot: carrier.dot_number, error: err.message });
          }
        }
        
        if (carriers.length < pageSize) break;
        page++;
        
        // Rate limiting - wait between pages
        await new Promise(r => setTimeout(r, 500));
      }

      // Update job
      await supabaseAdmin
        .from('lead_import_jobs')
        .update({
          status: 'completed',
          total_records: imported + skipped + duplicates + errors,
          imported_count: imported,
          skipped_count: skipped,
          duplicate_count: duplicates,
          error_count: errors,
          errors: errorList.length > 0 ? errorList : undefined,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

    } catch (err: any) {
      await supabaseAdmin
        .from('lead_import_jobs')
        .update({ status: 'failed', errors: [{ message: err.message }] })
        .eq('id', job.id);
      throw err;
    }

    return { jobId: job.id, imported, skipped, duplicates, errors };
  }

  /**
   * Import leads from CSV data (parsed array of objects)
   */
  async importCSVLeads(params: {
    records: Record<string, string>[];
    leadType: string;
    source?: string;
    columnMapping: Record<string, string>;  // csv_column -> lead_field
    createdBy?: string;
  }): Promise<{ jobId: string; imported: number; skipped: number; duplicates: number; errors: number }> {
    const { records, leadType, source = 'csv_import', columnMapping, createdBy } = params;

    const { data: job } = await supabaseAdmin
      .from('lead_import_jobs')
      .insert({
        source: 'csv_upload',
        status: 'processing',
        total_records: records.length,
        filters: { leadType, columnMapping },
        started_at: new Date().toISOString(),
        created_by: createdBy,
      })
      .select()
      .single();

    let imported = 0, skipped = 0, duplicates = 0, errors = 0;
    const errorList: any[] = [];

    for (const record of records) {
      try {
        // Map CSV columns to lead fields
        const lead: any = {
          source,
          lead_type: leadType,
        };

        for (const [csvCol, leadField] of Object.entries(columnMapping)) {
          if (record[csvCol] !== undefined && record[csvCol] !== '') {
            lead[leadField] = record[csvCol];
          }
        }

        if (!lead.company_name) {
          skipped++;
          continue;
        }

        // Deduplicate by email or phone
        if (lead.contact_email) {
          const { data: existing } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('contact_email', lead.contact_email)
            .maybeSingle();
          if (existing) { duplicates++; continue; }
        }

        lead.score = this.calculateLeadScore(lead);
        lead.created_by = createdBy;
        lead.raw_data = record;

        const { error: insertError } = await supabaseAdmin
          .from('leads')
          .insert(lead);

        if (insertError) {
          errors++;
          errorList.push({ row: record, error: insertError.message });
        } else {
          imported++;
        }
      } catch (err: any) {
        errors++;
        errorList.push({ error: err.message });
      }
    }

    if (job) {
      await supabaseAdmin
        .from('lead_import_jobs')
        .update({
          status: 'completed',
          imported_count: imported,
          skipped_count: skipped,
          duplicate_count: duplicates,
          error_count: errors,
          errors: errorList.length > 0 ? errorList : undefined,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }

    return { jobId: job?.id || '', imported, skipped, duplicates, errors };
  }

  /**
   * Calculate lead quality score (0-100)
   */
  calculateLeadScore(lead: Partial<LeadInput>): number {
    let score = 0;

    // Has email = high value
    if (lead.contact_email) score += 25;
    // Has phone
    if (lead.contact_phone) score += 15;
    // Has contact name
    if (lead.contact_first_name || lead.contact_last_name) score += 10;
    // Has company name
    if (lead.company_name) score += 5;
    // Fleet size scoring
    if (lead.fleet_size && lead.fleet_size > 0) {
      if (lead.fleet_size >= 50) score += 20;
      else if (lead.fleet_size >= 20) score += 15;
      else if (lead.fleet_size >= 5) score += 10;
      else score += 5;
    }
    // Total drivers
    if (lead.total_drivers && lead.total_drivers > 10) score += 10;
    // Has website 
    if (lead.website_url) score += 5;
    // USDOT/MC verified
    if (lead.usdot_number) score += 5;
    if (lead.mc_number) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Get leads with filtering and pagination
   */
  async getLeads(params: {
    page?: number;
    limit?: number;
    status?: string;
    leadType?: string;
    source?: string;
    state?: string;
    minScore?: number;
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    campaignId?: string;
  }) {
    const {
      page = 1,
      limit = 25,
      status,
      leadType,
      source,
      state,
      minScore,
      search,
      sortBy = 'created_at',
      sortDir = 'desc',
      campaignId,
    } = params;

    let query = supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (leadType) query = query.eq('lead_type', leadType);
    if (source) query = query.eq('source', source);
    if (state) query = query.eq('address_state', state);
    if (minScore) query = query.gte('score', minScore);
    if (campaignId) query = query.eq('campaign_id', campaignId);
    
    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,contact_email.ilike.%${search}%,contact_first_name.ilike.%${search}%,contact_last_name.ilike.%${search}%,usdot_number.ilike.%${search}%,mc_number.ilike.%${search}%`
      );
    }

    query = query
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range((page - 1) * limit, page * limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      leads: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  /**
   * Get lead stats for dashboard
   */
  async getLeadStats() {
    const [
      { count: total },
      { count: newLeads },
      { count: contacted },
      { count: qualified },
      { count: converted },
    ] = await Promise.all([
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'contacted'),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'qualified'),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'converted'),
    ]);

    // By type
    const { data: typeData } = await supabaseAdmin
      .from('leads')
      .select('lead_type');
    const byType: Record<string, number> = {};
    (typeData || []).forEach((l: any) => {
      byType[l.lead_type] = (byType[l.lead_type] || 0) + 1;
    });

    // By source
    const { data: sourceData } = await supabaseAdmin
      .from('leads')
      .select('source');
    const bySource: Record<string, number> = {};
    (sourceData || []).forEach((l: any) => {
      bySource[l.source] = (bySource[l.source] || 0) + 1;
    });

    // Recent imports
    const { data: recentImports } = await supabaseAdmin
      .from('lead_import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      total: total || 0,
      new: newLeads || 0,
      contacted: contacted || 0,
      qualified: qualified || 0,
      converted: converted || 0,
      byType,
      bySource,
      recentImports: recentImports || [],
    };
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId: string, status: string, notes?: string) {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (notes) updates.notes = notes;
    if (status === 'contacted') updates.last_contacted_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Bulk update lead status
   */
  async bulkUpdateStatus(leadIds: string[], status: string) {
    const { error } = await supabaseAdmin
      .from('leads')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', leadIds);

    if (error) throw error;
    return { updated: leadIds.length };
  }

  /**
   * Create or update a single lead
   */
  async upsertLead(lead: LeadInput & { id?: string }, createdBy?: string) {
    const data: any = {
      ...lead,
      score: this.calculateLeadScore(lead),
      updated_at: new Date().toISOString(),
    };

    if (!lead.id) {
      data.created_by = createdBy;
    }

    if (lead.id) {
      const { data: updated, error } = await supabaseAdmin
        .from('leads')
        .update(data)
        .eq('id', lead.id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('leads')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return created;
    }
  }

  /**
   * Delete leads
   */
  async deleteLeads(leadIds: string[]) {
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .in('id', leadIds);

    if (error) throw error;
    return { deleted: leadIds.length };
  }

  /**
   * Get campaigns
   */
  async getCampaigns(params?: { status?: string | undefined; page?: number | undefined; limit?: number | undefined }) {
    const { status, page = 1, limit = 20 } = params || {};
    
    let query = supabaseAdmin
      .from('outreach_campaigns')
      .select('*', { count: 'exact' });

    if (status) query = query.eq('status', status);
    
    query = query.order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { campaigns: data || [], total: count || 0 };
  }

  /**
   * Create campaign
   */
  async createCampaign(campaign: {
    name: string;
    description?: string;
    campaign_type: string;
    target_lead_type: string;
    email_subject?: string;
    email_body?: string;
    sms_body?: string;
    target_filters?: any;
    created_by?: string;
  }) {
    const { data, error } = await supabaseAdmin
      .from('outreach_campaigns')
      .insert(campaign)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get import jobs
   */
  async getImportJobs(limit = 20) {
    const { data, error } = await supabaseAdmin
      .from('lead_import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

export const leadAcquisitionService = new LeadAcquisitionService();
