// database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          phone: string | null
          avatar_url: string | null
          role: 'client' | 'driver' | 'admin'
          is_verified: boolean
          rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name: string
          last_name: string
          phone?: string | null
          avatar_url?: string | null
          role?: 'client' | 'driver' | 'admin'
          is_verified?: boolean
          rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          phone?: string | null
          avatar_url?: string | null
          role?: 'client' | 'driver' | 'admin'
          is_verified?: boolean
          rating?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      driver_applications: {
        Row: {
          id: string
          user_id: string
          status: string
          vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle'
          vehicle_make: string
          vehicle_model: string
          vehicle_year: number
          license_number: string
          license_expiry: string
          insurance_provider: string
          insurance_policy_number: string
          insurance_expiry: string
          background_check_status: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle'
          vehicle_make: string
          vehicle_model: string
          vehicle_year: number
          license_number: string
          license_expiry: string
          insurance_provider: string
          insurance_policy_number: string
          insurance_expiry: string
          background_check_status?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          vehicle_type?: 'car' | 'van' | 'truck' | 'motorcycle'
          vehicle_make?: string
          vehicle_model?: string
          vehicle_year?: number
          license_number?: string
          license_expiry?: string
          insurance_provider?: string
          insurance_policy_number?: string
          insurance_expiry?: string
          background_check_status?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
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
      vehicle_photos: {
        Row: {
          id: string
          driver_application_id: string
          photo_url: string
          photo_type: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          driver_application_id: string
          photo_url: string
          photo_type: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          driver_application_id?: string
          photo_url?: string
          photo_type?: string
          uploaded_at?: string
        }
      }
      shipments: {
        Row: {
          id: string
          client_id: string
          driver_id: string | null
          status: 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled'
          title: string
          description: string | null
          pickup_address: string
          pickup_location: unknown
          pickup_notes: string | null
          pickup_time_window: unknown | null
          delivery_address: string
          delivery_location: unknown
          delivery_notes: string | null
          delivery_time_window: unknown | null
          weight_kg: number | null
          dimensions_cm: Json | null
          item_value: number | null
          is_fragile: boolean | null
          estimated_distance_km: number | null
          estimated_price: number
          final_price: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          driver_id?: string | null
          status?: 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled'
          title: string
          description?: string | null
          pickup_address: string
          pickup_location: unknown
          pickup_notes?: string | null
          pickup_time_window?: unknown | null
          delivery_address: string
          delivery_location: unknown
          delivery_notes?: string | null
          delivery_time_window?: unknown | null
          weight_kg?: number | null
          dimensions_cm?: Json | null
          item_value?: number | null
          is_fragile?: boolean | null
          estimated_distance_km?: number | null
          estimated_price: number
          final_price?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          driver_id?: string | null
          status?: 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled'
          title?: string
          description?: string | null
          pickup_address?: string
          pickup_location?: unknown
          pickup_notes?: string | null
          pickup_time_window?: unknown | null
          delivery_address?: string
          delivery_location?: unknown
          delivery_notes?: string | null
          delivery_time_window?: unknown | null
          weight_kg?: number | null
          dimensions_cm?: Json | null
          item_value?: number | null
          is_fragile?: boolean | null
          estimated_distance_km?: number | null
          estimated_price?: number
          final_price?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      tracking_events: {
        Row: {
          id: string
          shipment_id: string
          event_type: 'created' | 'accepted' | 'pickup' | 'in_transit' | 'delivery' | 'cancelled' | 'delayed'
          created_by: string
          location: unknown | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          shipment_id: string
          event_type: 'created' | 'accepted' | 'pickup' | 'in_transit' | 'delivery' | 'cancelled' | 'delayed'
          created_by: string
          location?: unknown | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          shipment_id?: string
          event_type?: 'created' | 'accepted' | 'pickup' | 'in_transit' | 'delivery' | 'cancelled' | 'delayed'
          created_by?: string
          location?: unknown | null
          notes?: string | null
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          shipment_id: string
          sender_id: string
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          shipment_id: string
          sender_id: string
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          shipment_id?: string
          sender_id?: string
          content?: string
          is_read?: boolean
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          shipment_id: string
          client_id: string
          amount: number
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
          payment_method: string | null
          payment_intent_id: string | null
          payment_intent_client_secret: string | null
          refund_id: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shipment_id: string
          client_id: string
          amount: number
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
          payment_method?: string | null
          payment_intent_id?: string | null
          payment_intent_client_secret?: string | null
          refund_id?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shipment_id?: string
          client_id?: string
          amount?: number
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
          payment_method?: string | null
          payment_intent_id?: string | null
          payment_intent_client_secret?: string | null
          refund_id?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_shipment: {
        Args: {
          shipment_id: string
        }
        Returns: {
          id: string
          client_id: string
          driver_id: string | null
          status: 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled'
          title: string
          description: string | null
          pickup_address: string
          pickup_location: unknown
          pickup_notes: string | null
          pickup_time_window: unknown | null
          delivery_address: string
          delivery_location: unknown
          delivery_notes: string | null
          delivery_time_window: unknown | null
          weight_kg: number | null
          dimensions_cm: Json | null
          item_value: number | null
          is_fragile: boolean | null
          estimated_distance_km: number | null
          estimated_price: number
          final_price: number | null
          created_at: string
          updated_at: string
        }[]
      }
      create_tracking_event: {
        Args: {
          p_shipment_id: string
          p_event_type: 'created' | 'accepted' | 'pickup' | 'in_transit' | 'delivery' | 'cancelled' | 'delayed'
          p_location?: unknown
          p_notes?: string
        }
        Returns: string
      }
      get_nearby_shipments: {
        Args: {
          p_lat: number
          p_lng: number
          p_distance_km?: number
        }
        Returns: {
          id: string
          client_id: string
          driver_id: string | null
          status: 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled'
          title: string
          description: string | null
          pickup_address: string
          pickup_location: unknown
          pickup_notes: string | null
          pickup_time_window: unknown | null
          delivery_address: string
          delivery_location: unknown
          delivery_notes: string | null
          delivery_time_window: unknown | null
          weight_kg: number | null
          dimensions_cm: Json | null
          item_value: number | null
          is_fragile: boolean | null
          estimated_distance_km: number | null
          estimated_price: number
          final_price: number | null
          created_at: string
          updated_at: string
        }[]
      }
      mark_message_read: {
        Args: {
          p_message_id: string
        }
        Returns: boolean
      }
      verify_driver: {
        Args: {
          p_driver_id: string
        }
        Returns: boolean
      }
      update_payment_status: {
        Args: {
          p_payment_id: string
          p_status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
          p_payment_intent_id?: string
          p_payment_intent_client_secret?: string
          p_metadata?: Json
        }
        Returns: {
          id: string
          shipment_id: string
          client_id: string
          amount: number
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
          payment_method: string | null
          payment_intent_id: string | null
          payment_intent_client_secret: string | null
          refund_id: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      user_role: 'client' | 'driver' | 'admin'
      shipment_status: 'pending' | 'accepted' | 'in_transit' | 'delivered' | 'cancelled'
      vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle'
      payment_status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
      tracking_event_type: 'created' | 'accepted' | 'pickup' | 'in_transit' | 'delivery' | 'cancelled' | 'delayed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
