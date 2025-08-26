import { supabase } from '../lib/supabase';
import logger from '../utils/logger';
import {
  checkTableExists,
  getActualTableName,
  ensureTablesExist,
} from '../db/dbUtils';

// Types
export interface Application {
  id: string;
  shipment_id: string;
  driver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  applied_at: string;
  updated_at: string | null;
  driver?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
    rating: number | null;
  };
}

/**
 * Service for handling job applications with built-in fallbacks
 */
export class ApplicationService {
  private static jobApplicationsTableName: string = 'job_applications';
  private static hasCheckedTable: boolean = false;

  /**
   * Initialize the service and ensure tables exist
   */
  private static async initialize(): Promise<void> {
    if (this.hasCheckedTable) return;

    try {
      // Check if job_applications table exists
      const tableExists = await checkTableExists(this.jobApplicationsTableName);

      if (!tableExists) {
        logger.warn(
          `Table ${this.jobApplicationsTableName} does not exist, attempting to find alternative or create it`
        );

        // Try to find actual table name if it exists with a different name
        const actualTableName = await getActualTableName(
          this.jobApplicationsTableName
        );

        if (actualTableName !== this.jobApplicationsTableName) {
          logger.info(`Found alternative table name: ${actualTableName}`);
          this.jobApplicationsTableName = actualTableName;
        } else {
          // Try to create the table using embedded SQL
          logger.info('Attempting to create job_applications table');

          // Embedded fallback SQL
          const fallbackSql = `
            CREATE TABLE IF NOT EXISTS job_applications (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              shipment_id UUID NOT NULL,
              driver_id UUID NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ,
              UNIQUE (shipment_id, driver_id)
            );
            
            CREATE INDEX IF NOT EXISTS job_applications_shipment_id_idx ON job_applications(shipment_id);
            CREATE INDEX IF NOT EXISTS job_applications_driver_id_idx ON job_applications(driver_id);
          `;
          await ensureTablesExist(fallbackSql);
        }
      } else {
        logger.info(`Table ${this.jobApplicationsTableName} exists`);
      }

      this.hasCheckedTable = true;
    } catch (error) {
      logger.error('Error during ApplicationService initialization:', error);
    }
  }

  /**
   * Get all job applications for a shipment with multiple fallback methods
   */
  static async getApplicationsForShipment(
    shipmentId: string
  ): Promise<Application[]> {
    await this.initialize();

    try {
      logger.info(
        `ApplicationService: Getting applications for shipment ${shipmentId} from ${this.jobApplicationsTableName}`
      );

      // First try: Standard job_applications query with join
      const { data: applications, error } = await supabase
        .from(this.jobApplicationsTableName)
        .select(
          `
          *,
          driver:driver_id(
            id, 
            first_name, 
            last_name, 
            email, 
            phone, 
            avatar_url, 
            rating
          )
        `
        )
        .eq('shipment_id', shipmentId);

      if (!error && applications?.length) {
        logger.info(
          `ApplicationService: Found ${applications.length} applications via standard query`
        );
        return applications;
      } else {
        logger.warn(
          `Error or no results from standard query:`,
          error || 'No applications found'
        );
      }

      // Second attempt: Try without the join
      const { data: basicApplications, error: basicError } = await supabase
        .from(this.jobApplicationsTableName)
        .select('*')
        .eq('shipment_id', shipmentId);

      if (!basicError && basicApplications?.length) {
        logger.info(
          `ApplicationService: Found ${basicApplications.length} basic applications, fetching driver details`
        );

        // Fetch driver profiles separately
        const enrichedApplications = await Promise.all(
          basicApplications.map(async app => {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select(
                  'id, first_name, last_name, email, phone, avatar_url, rating'
                )
                .eq('id', app.driver_id)
                .single();

              return {
                ...app,
                driver: profileData || undefined,
              };
            } catch (error) {
              logger.error(
                `Error fetching profile for driver ${app.driver_id}:`,
                error
              );
              return app;
            }
          })
        );

        return enrichedApplications;
      }

      // Try a view if it exists
      const { data: viewApplications, error: viewError } = await supabase
        .from('shipment_applications_view')
        .select('*')
        .eq('shipment_id', shipmentId);

      if (!viewError && viewApplications?.length) {
        logger.info(
          `ApplicationService: Found ${viewApplications.length} applications via view`
        );
        return viewApplications;
      }

      // Final fallback: Direct profiles query with manual connection
      logger.info(
        'ApplicationService: Trying direct drivers query as fallback'
      );

      // No longer creating mock applications - just return empty array
      logger.info(
        'ApplicationService: No applications found for this shipment'
      );
      return [];
    } catch (error) {
      logger.error(
        'ApplicationService.getApplicationsForShipment error:',
        error
      );
      return [];
    }
  }

  /**
   * Update an application status
   */
  static async updateApplicationStatus(
    applicationId: string,
    status: 'pending' | 'accepted' | 'rejected'
  ): Promise<boolean> {
    await this.initialize();

    try {
      // Skip update for mock applications
      if (applicationId.startsWith('mock-')) {
        logger.info(
          `Mock application ${applicationId} status updated to ${status}`
        );
        return true;
      }

      const { error } = await supabase
        .from(this.jobApplicationsTableName)
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (error) {
        logger.error(
          `Error updating application ${applicationId} status:`,
          error
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error(
        `Exception updating application ${applicationId} status:`,
        error
      );
      return false;
    }
  }

  /**
   * Create a new application
   */
  static async createApplication(
    shipmentId: string,
    driverId: string
  ): Promise<Application | null> {
    await this.initialize();

    try {
      const { data, error } = await supabase
        .from(this.jobApplicationsTableName)
        .insert({
          shipment_id: shipmentId,
          driver_id: driverId,
          status: 'pending',
          applied_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error(
          `Error creating application for shipment ${shipmentId}:`,
          error
        );
        return null;
      }

      return data;
    } catch (error) {
      logger.error(
        `Exception creating application for shipment ${shipmentId}:`,
        error
      );
      return null;
    }
  }
}
