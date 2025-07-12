// Update for database.types.ts - new push_tokens and notification_preferences tables

import { Database as ExistingDatabase } from './database.types';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database extends ExistingDatabase {
  public: {
    Tables: {
      // Existing tables...
      push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          device_type: string
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          device_type: string
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          device_type?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          push_enabled: boolean
          email_enabled: boolean
          sms_enabled: boolean
          shipment_updates: boolean
          driver_assigned: boolean
          payment_updates: boolean
          promotions: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          push_enabled?: boolean
          email_enabled?: boolean
          sms_enabled?: boolean
          shipment_updates?: boolean
          driver_assigned?: boolean
          payment_updates?: boolean
          promotions?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          push_enabled?: boolean
          email_enabled?: boolean
          sms_enabled?: boolean
          shipment_updates?: boolean
          driver_assigned?: boolean
          payment_updates?: boolean
          promotions?: boolean
          created_at?: string
          updated_at?: string | null
        }
      }
    }
    // ...other existing properties
  }
}
