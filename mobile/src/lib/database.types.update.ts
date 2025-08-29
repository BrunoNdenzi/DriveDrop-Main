// Update for database.types.ts - new push_tokens and notification_preferences tables

// This file provides supplementary table typings; not merged to avoid conflicts.


export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// NOTE: This file augments schema; to avoid interface incompatibility we export a separate type.
export interface PushTokensTableDefinitions {
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
  }
}
