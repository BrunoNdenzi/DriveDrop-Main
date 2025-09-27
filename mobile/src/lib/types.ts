// types.d.ts - Custom type definitions for Supabase

// Extend the @supabase/supabase-js module
import { Database } from './database.types';

declare module '@supabase/supabase-js' {
  // Define table types
  export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
  export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
  export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

  // Extend the PostgrestBuilder interface to handle our types
  export interface PostgrestBuilder<T> {
    execute(): Promise<{ data: T | null; error: Error | null }>;
  }
}

// Export common types
export type Shipment = Database['public']['Tables']['shipments']['Row'];
export type ShipmentInsert = Database['public']['Tables']['shipments']['Insert'];
export type ShipmentUpdate = Database['public']['Tables']['shipments']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type JobApplication = Database['public']['Tables']['job_applications']['Row'];
export type TrackingEvent = Database['public']['Tables']['tracking_events']['Row'];

// Payment status type
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

// Shipment status type
export type ShipmentStatus = 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled';