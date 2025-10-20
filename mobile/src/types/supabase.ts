export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      client_addresses: {
        Row: {
          city: string
          client_id: string
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          is_delivery_location: boolean | null
          is_pickup_location: boolean | null
          label: string
          special_instructions: string | null
          state: string
          street_address: string
          updated_at: string | null
          zip_code: string
        }
        Insert: {
          city: string
          client_id: string
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_delivery_location?: boolean | null
          is_pickup_location?: boolean | null
          label: string
          special_instructions?: string | null
          state: string
          street_address: string
          updated_at?: string | null
          zip_code: string
        }
        Update: {
          city?: string
          client_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_delivery_location?: boolean | null
          is_pickup_location?: boolean | null
          label?: string
          special_instructions?: string | null
          state?: string
          street_address?: string
          updated_at?: string | null
          zip_code?: string
        }
        Relationships: []
      }
      client_payment_methods: {
        Row: {
          billing_address: Json | null
          card_brand: string | null
          client_id: string
          created_at: string | null
          expiry_month: number | null
          expiry_year: number | null
          id: string
          is_default: boolean | null
          last_four: string | null
          payment_type: string
          provider: string
          provider_payment_method_id: string
          updated_at: string | null
        }
        Insert: {
          billing_address?: Json | null
          card_brand?: string | null
          client_id: string
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          payment_type: string
          provider: string
          provider_payment_method_id: string
          updated_at?: string | null
        }
        Update: {
          billing_address?: Json | null
          card_brand?: string | null
          client_id?: string
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          payment_type?: string
          provider?: string
          provider_payment_method_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_settings: {
        Row: {
          auto_quotes: boolean | null
          client_id: string
          created_at: string | null
          email_notifications: boolean | null
          id: string
          marketing_emails: boolean | null
          preferred_communication: string | null
          promotional_offers: boolean | null
          push_notifications: boolean | null
          quote_notifications: boolean | null
          shipment_updates: boolean | null
          sms_notifications: boolean | null
          updated_at: string | null
        }
        Insert: {
          auto_quotes?: boolean | null
          client_id: string
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          marketing_emails?: boolean | null
          preferred_communication?: string | null
          promotional_offers?: boolean | null
          push_notifications?: boolean | null
          quote_notifications?: boolean | null
          shipment_updates?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string | null
        }
        Update: {
          auto_quotes?: boolean | null
          client_id?: string
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          marketing_emails?: boolean | null
          preferred_communication?: string | null
          promotional_offers?: boolean | null
          push_notifications?: boolean | null
          quote_notifications?: boolean | null
          shipment_updates?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          client_id: string
          created_at: string | null
          driver_id: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          shipment_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          driver_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          shipment_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          driver_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "conversation_participants"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "conversations_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "conversation_summaries"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "conversations_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_applications: {
        Row: {
          background_check_status: string | null
          created_at: string
          id: string
          insurance_expiry: string
          insurance_policy_number: string
          insurance_provider: string
          license_expiry: string
          license_number: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle_make: string
          vehicle_model: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          vehicle_year: number
        }
        Insert: {
          background_check_status?: string | null
          created_at?: string
          id?: string
          insurance_expiry: string
          insurance_policy_number: string
          insurance_provider: string
          license_expiry: string
          license_number: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle_make: string
          vehicle_model: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          vehicle_year: number
        }
        Update: {
          background_check_status?: string | null
          created_at?: string
          id?: string
          insurance_expiry?: string
          insurance_policy_number?: string
          insurance_provider?: string
          license_expiry?: string
          license_number?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_make?: string
          vehicle_model?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          vehicle_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          driver_id: string
          heading: number | null
          id: string
          latitude: number
          location_timestamp: string
          longitude: number
          shipment_id: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          driver_id: string
          heading?: number | null
          id?: string
          latitude: number
          location_timestamp?: string
          longitude: number
          shipment_id: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          driver_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          location_timestamp?: string
          longitude?: number
          shipment_id?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_participants"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "driver_locations_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "driver_locations_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_privacy_preferences: {
        Row: {
          allow_rating_and_reviews: boolean | null
          created_at: string | null
          data_retention_period: string | null
          driver_id: string
          id: string
          share_location_with_customers: boolean | null
          share_phone_with_customers: boolean | null
          updated_at: string | null
        }
        Insert: {
          allow_rating_and_reviews?: boolean | null
          created_at?: string | null
          data_retention_period?: string | null
          driver_id: string
          id?: string
          share_location_with_customers?: boolean | null
          share_phone_with_customers?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allow_rating_and_reviews?: boolean | null
          created_at?: string | null
          data_retention_period?: string | null
          driver_id?: string
          id?: string
          share_location_with_customers?: boolean | null
          share_phone_with_customers?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_ratings: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string | null
          driver_id: string
          id: string
          rating: number
          shipment_id: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string | null
          driver_id: string
          id?: string
          rating: number
          shipment_id: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string | null
          driver_id?: string
          id?: string
          rating?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_ratings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "conversation_participants"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "driver_ratings_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "conversation_summaries"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "driver_ratings_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_security_settings: {
        Row: {
          biometric_enabled: boolean | null
          created_at: string | null
          data_analytics_enabled: boolean | null
          driver_id: string
          emergency_contacts_enabled: boolean | null
          id: string
          location_sharing_enabled: boolean | null
          marketing_emails_enabled: boolean | null
          profile_visibility: string | null
          push_notifications_enabled: boolean | null
          trip_history_visibility: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          biometric_enabled?: boolean | null
          created_at?: string | null
          data_analytics_enabled?: boolean | null
          driver_id: string
          emergency_contacts_enabled?: boolean | null
          id?: string
          location_sharing_enabled?: boolean | null
          marketing_emails_enabled?: boolean | null
          profile_visibility?: string | null
          push_notifications_enabled?: boolean | null
          trip_history_visibility?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          biometric_enabled?: boolean | null
          created_at?: string | null
          data_analytics_enabled?: boolean | null
          driver_id?: string
          emergency_contacts_enabled?: boolean | null
          id?: string
          location_sharing_enabled?: boolean | null
          marketing_emails_enabled?: boolean | null
          profile_visibility?: string | null
          push_notifications_enabled?: boolean | null
          trip_history_visibility?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_settings: {
        Row: {
          allow_location_tracking: boolean | null
          available_for_jobs: boolean | null
          created_at: string | null
          driver_id: string
          id: string
          notifications_enabled: boolean | null
          preferred_job_types: string[] | null
          preferred_radius: number | null
          updated_at: string | null
        }
        Insert: {
          allow_location_tracking?: boolean | null
          available_for_jobs?: boolean | null
          created_at?: string | null
          driver_id: string
          id?: string
          notifications_enabled?: boolean | null
          preferred_job_types?: string[] | null
          preferred_radius?: number | null
          updated_at?: string | null
        }
        Update: {
          allow_location_tracking?: boolean | null
          available_for_jobs?: boolean | null
          created_at?: string | null
          driver_id?: string
          id?: string
          notifications_enabled?: boolean | null
          preferred_job_types?: string[] | null
          preferred_radius?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_settings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_vehicles: {
        Row: {
          capacity_volume: number | null
          capacity_weight: number | null
          color: string
          created_at: string | null
          driver_id: string
          id: string
          insurance_expiry_date: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          is_active: boolean | null
          license_plate: string
          make: string
          model: string
          registration_expiry_date: string | null
          registration_number: string | null
          updated_at: string | null
          vehicle_type: string | null
          year: number
        }
        Insert: {
          capacity_volume?: number | null
          capacity_weight?: number | null
          color: string
          created_at?: string | null
          driver_id: string
          id?: string
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean | null
          license_plate: string
          make: string
          model: string
          registration_expiry_date?: string | null
          registration_number?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
          year: number
        }
        Update: {
          capacity_volume?: number | null
          capacity_weight?: number | null
          color?: string
          created_at?: string | null
          driver_id?: string
          id?: string
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean | null
          license_plate?: string
          make?: string
          model?: string
          registration_expiry_date?: string | null
          registration_number?: string | null
          updated_at?: string | null
          vehicle_type?: string | null
          year?: number
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applied_at: string | null
          created_at: string | null
          driver_id: string
          id: string
          notes: string | null
          responded_at: string | null
          shipment_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string | null
          driver_id: string
          id?: string
          notes?: string | null
          responded_at?: string | null
          shipment_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string | null
          driver_id?: string
          id?: string
          notes?: string | null
          responded_at?: string | null
          shipment_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_participants"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "job_applications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "job_applications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          message_type: string
          metadata: Json | null
          read_at: string | null
          receiver_id: string
          sender_id: string
          shipment_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          receiver_id: string
          sender_id: string
          shipment_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          shipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_participants"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "messages_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "messages_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          delivery_completed: boolean | null
          driver_assigned: boolean
          email_notifications: boolean
          id: string
          messages: boolean | null
          payment_updates: boolean
          promotions: boolean
          push_notifications: boolean
          shipment_updates: boolean
          sms_notifications: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_completed?: boolean | null
          driver_assigned?: boolean
          email_notifications?: boolean
          id?: string
          messages?: boolean | null
          payment_updates?: boolean
          promotions?: boolean
          push_notifications?: boolean
          shipment_updates?: boolean
          sms_notifications?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_completed?: boolean | null
          driver_assigned?: boolean
          email_notifications?: boolean
          id?: string
          messages?: boolean | null
          payment_updates?: boolean
          promotions?: boolean
          push_notifications?: boolean
          shipment_updates?: boolean
          sms_notifications?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_timestamp: string | null
          client_id: string
          created_at: string
          id: string
          initial_amount: number | null
          is_refundable: boolean | null
          metadata: Json | null
          parent_payment_id: string | null
          payment_intent_client_secret: string | null
          payment_intent_id: string | null
          payment_method: string | null
          payment_type: string | null
          refund_deadline: string | null
          refund_id: string | null
          remaining_amount: number | null
          shipment_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_timestamp?: string | null
          client_id: string
          created_at?: string
          id?: string
          initial_amount?: number | null
          is_refundable?: boolean | null
          metadata?: Json | null
          parent_payment_id?: string | null
          payment_intent_client_secret?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_type?: string | null
          refund_deadline?: string | null
          refund_id?: string | null
          remaining_amount?: number | null
          shipment_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_timestamp?: string | null
          client_id?: string
          created_at?: string
          id?: string
          initial_amount?: number | null
          is_refundable?: boolean | null
          metadata?: Json | null
          parent_payment_id?: string | null
          payment_intent_client_secret?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_type?: string | null
          refund_deadline?: string | null
          refund_id?: string | null
          remaining_amount?: number | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_payment_id_fkey"
            columns: ["parent_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_participants"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "payments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "payments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          allow_analytics: boolean | null
          created_at: string | null
          id: string
          location_tracking: boolean | null
          share_profile: boolean | null
          show_online_status: boolean | null
          two_factor_auth: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allow_analytics?: boolean | null
          created_at?: string | null
          id?: string
          location_tracking?: boolean | null
          share_profile?: boolean | null
          show_online_status?: boolean | null
          two_factor_auth?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allow_analytics?: boolean | null
          created_at?: string | null
          id?: string
          location_tracking?: boolean | null
          share_profile?: boolean | null
          show_online_status?: boolean | null
          two_factor_auth?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_verified: boolean
          last_name: string
          phone: string | null
          rating: number | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id: string
          is_verified?: boolean
          last_name: string
          phone?: string | null
          rating?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_verified?: boolean
          last_name?: string
          phone?: string | null
          rating?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          device_type: string
          id: string
          is_active: boolean
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type: string
          id?: string
          is_active?: boolean
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string
          id?: string
          is_active?: boolean
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shipment_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string
          created_at: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Insert: {
          changed_at?: string | null
          changed_by: string
          created_at?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Update: {
          changed_at?: string | null
          changed_by?: string
          created_at?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_status_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_participants"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "shipment_status_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "shipment_status_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          cargo_type: string | null
          client_id: string
          created_at: string
          delivery_address: string
          delivery_city: string | null
          delivery_date: string | null
          delivery_location: unknown | null
          delivery_notes: string | null
          delivery_state: string | null
          delivery_time_window: unknown | null
          delivery_zip: string | null
          description: string | null
          dimensions: string | null
          dimensions_cm: Json | null
          distance: number | null
          driver_id: string | null
          estimated_distance_km: number | null
          estimated_price: number
          final_price: number | null
          id: string
          is_accident_recovery: boolean | null
          is_fragile: boolean | null
          is_operable: boolean | null
          item_value: number | null
          payment_intent_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_address: string
          pickup_city: string | null
          pickup_date: string | null
          pickup_location: unknown | null
          pickup_notes: string | null
          pickup_state: string | null
          pickup_time_window: unknown | null
          pickup_zip: string | null
          price: number | null
          status: Database["public"]["Enums"]["shipment_status"]
          terms_accepted: boolean | null
          title: string
          updated_at: string
          updated_by: string | null
          vehicle_count: number | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: string | null
          vehicle_year: number | null
          weight: number | null
          weight_kg: number | null
        }
        Insert: {
          cargo_type?: string | null
          client_id: string
          created_at?: string
          delivery_address: string
          delivery_city?: string | null
          delivery_date?: string | null
          delivery_location?: unknown | null
          delivery_notes?: string | null
          delivery_state?: string | null
          delivery_time_window?: unknown | null
          delivery_zip?: string | null
          description?: string | null
          dimensions?: string | null
          dimensions_cm?: Json | null
          distance?: number | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          estimated_price: number
          final_price?: number | null
          id?: string
          is_accident_recovery?: boolean | null
          is_fragile?: boolean | null
          is_operable?: boolean | null
          item_value?: number | null
          payment_intent_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address: string
          pickup_city?: string | null
          pickup_date?: string | null
          pickup_location?: unknown | null
          pickup_notes?: string | null
          pickup_state?: string | null
          pickup_time_window?: unknown | null
          pickup_zip?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["shipment_status"]
          terms_accepted?: boolean | null
          title: string
          updated_at?: string
          updated_by?: string | null
          vehicle_count?: number | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
          weight?: number | null
          weight_kg?: number | null
        }
        Update: {
          cargo_type?: string | null
          client_id?: string
          created_at?: string
          delivery_address?: string
          delivery_city?: string | null
          delivery_date?: string | null
          delivery_location?: unknown | null
          delivery_notes?: string | null
          delivery_state?: string | null
          delivery_time_window?: unknown | null
          delivery_zip?: string | null
          description?: string | null
          dimensions?: string | null
          dimensions_cm?: Json | null
          distance?: number | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          estimated_price?: number
          final_price?: number | null
          id?: string
          is_accident_recovery?: boolean | null
          is_fragile?: boolean | null
          is_operable?: boolean | null
          item_value?: number | null
          payment_intent_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address?: string
          pickup_city?: string | null
          pickup_date?: string | null
          pickup_location?: unknown | null
          pickup_notes?: string | null
          pickup_state?: string | null
          pickup_time_window?: unknown | null
          pickup_zip?: string | null
          price?: number | null
          status?: Database["public"]["Enums"]["shipment_status"]
          terms_accepted?: boolean | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_count?: number | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
          weight?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string | null
          description: string
          id: string
          priority: string
          resolved_at: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          id?: string
          priority: string
          resolved_at?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          created_at: string
          created_by: string
          event_type: Database["public"]["Enums"]["tracking_event_type"]
          id: string
          location: unknown | null
          notes: string | null
          shipment_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_type: Database["public"]["Enums"]["tracking_event_type"]
          id?: string
          location?: unknown | null
          notes?: string | null
          shipment_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_type?: Database["public"]["Enums"]["tracking_event_type"]
          id?: string
          location?: unknown | null
          notes?: string | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_participants"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_vehicles: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          license_plate: string | null
          make: string
          model: string
          nickname: string | null
          updated_at: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          year: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          license_plate?: string | null
          make: string
          model: string
          nickname?: string | null
          updated_at?: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          year: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          license_plate?: string | null
          make?: string
          model?: string
          nickname?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photos: {
        Row: {
          driver_application_id: string
          id: string
          photo_type: string
          photo_url: string
          uploaded_at: string
        }
        Insert: {
          driver_application_id: string
          id?: string
          photo_type: string
          photo_url: string
          uploaded_at?: string
        }
        Update: {
          driver_application_id?: string
          id?: string
          photo_type?: string
          photo_url?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_driver_application_id_fkey"
            columns: ["driver_application_id"]
            isOneToOne: false
            referencedRelation: "driver_applications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      conversation_participants: {
        Row: {
          admin_ids: string[] | null
          client_id: string | null
          driver_id: string | null
          shipment_created_at: string | null
          shipment_id: string | null
          shipment_status: Database["public"]["Enums"]["shipment_status"] | null
          shipment_updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          client_avatar: string | null
          client_id: string | null
          client_name: string | null
          driver_avatar: string | null
          driver_id: string | null
          driver_name: string | null
          last_message_at: string | null
          last_message_content: string | null
          shipment_id: string | null
          shipment_status: Database["public"]["Enums"]["shipment_status"] | null
          shipment_title: string | null
          unread_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown | null
          f_table_catalog: unknown | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown | null
          f_table_catalog: string | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      shipment_applications_view: {
        Row: {
          applied_at: string | null
          created_at: string | null
          driver_id: string | null
          id: string | null
          shipment_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string | null
          driver_id?: string | null
          id?: string | null
          shipment_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string | null
          driver_id?: string | null
          id?: string | null
          shipment_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_participants"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "job_applications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "job_applications_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_scripts_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_bestsrid: {
        Args: { "": unknown }
        Returns: number
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_pointoutside: {
        Args: { "": unknown }
        Returns: unknown
      }
      _st_sortablehash: {
        Args: { geom: unknown }
        Returns: number
      }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      accept_shipment: {
        Args: { shipment_id: string }
        Returns: {
          cargo_type: string | null
          client_id: string
          created_at: string
          delivery_address: string
          delivery_city: string | null
          delivery_date: string | null
          delivery_location: unknown | null
          delivery_notes: string | null
          delivery_state: string | null
          delivery_time_window: unknown | null
          delivery_zip: string | null
          description: string | null
          dimensions: string | null
          dimensions_cm: Json | null
          distance: number | null
          driver_id: string | null
          estimated_distance_km: number | null
          estimated_price: number
          final_price: number | null
          id: string
          is_accident_recovery: boolean | null
          is_fragile: boolean | null
          is_operable: boolean | null
          item_value: number | null
          payment_intent_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_address: string
          pickup_city: string | null
          pickup_date: string | null
          pickup_location: unknown | null
          pickup_notes: string | null
          pickup_state: string | null
          pickup_time_window: unknown | null
          pickup_zip: string | null
          price: number | null
          status: Database["public"]["Enums"]["shipment_status"]
          terms_accepted: boolean | null
          title: string
          updated_at: string
          updated_by: string | null
          vehicle_count: number | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: string | null
          vehicle_year: number | null
          weight: number | null
          weight_kg: number | null
        }[]
      }
      addauth: {
        Args: { "": string }
        Returns: boolean
      }
      addgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
        Returns: string
      }
      apply_for_shipment: {
        Args: { p_driver_id: string; p_notes?: string; p_shipment_id: string }
        Returns: Json
      }
      assign_driver_to_shipment: {
        Args: {
          p_create_application?: boolean
          p_driver_id: string
          p_shipment_id: string
        }
        Returns: Json
      }
      box: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box3d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3dtobox: {
        Args: { "": unknown }
        Returns: unknown
      }
      bytea: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      can_access_conversation: {
        Args: { p_conversation_id: string; p_user_id?: string }
        Returns: boolean
      }
      check_cancellation_eligibility: {
        Args: { p_shipment_id: string }
        Returns: Json
      }
      check_refund_eligibility: {
        Args: { payment_id: string }
        Returns: boolean
      }
      cleanup_expired_conversations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_messages: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_tracking_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_final_payment: {
        Args: {
          p_parent_payment_id: string
          p_shipment_id: string
          p_user_id: string
        }
        Returns: {
          payment_intent_amount: number
          payment_intent_description: string
        }[]
      }
      create_tracking_event: {
        Args: {
          p_event_type: Database["public"]["Enums"]["tracking_event_type"]
          p_location?: unknown
          p_notes?: string
          p_shipment_id: string
        }
        Returns: string
      }
      disablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      dropgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
          | { column_name: string; schema_name: string; table_name: string }
          | { column_name: string; table_name: string }
        Returns: string
      }
      dropgeometrytable: {
        Args:
          | { catalog_name: string; schema_name: string; table_name: string }
          | { schema_name: string; table_name: string }
          | { table_name: string }
        Returns: string
      }
      enablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      exec_sql: {
        Args: { sql: string }
        Returns: undefined
      }
      geography: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      geography_analyze: {
        Args: { "": unknown }
        Returns: boolean
      }
      geography_gist_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_gist_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_send: {
        Args: { "": unknown }
        Returns: string
      }
      geography_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geography_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry: {
        Args:
          | { "": string }
          | { "": string }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
        Returns: unknown
      }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_analyze: {
        Args: { "": unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_sortsupport_2d: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_hash: {
        Args: { "": unknown }
        Returns: number
      }
      geometry_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_recv: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_send: {
        Args: { "": unknown }
        Returns: string
      }
      geometry_sortsupport: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_spgist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_3d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geometry_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometrytype: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      get_conversation_by_shipment: {
        Args: { p_shipment_id: string }
        Returns: Json
      }
      get_conversation_messages_v2: {
        Args: { p_conversation_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_conversation_participants: {
        Args: { p_shipment_id: string }
        Returns: {
          client_avatar: string
          client_id: string
          client_name: string
          driver_avatar: string
          driver_id: string
          driver_name: string
        }[]
      }
      get_driver_applications: {
        Args: { p_driver_id: string; p_status?: string }
        Returns: {
          applied_at: string
          created_at: string
          driver_id: string
          id: string
          notes: string
          responded_at: string
          shipment_id: string
          status: string
          updated_at: string
        }[]
      }
      get_driver_settings: {
        Args: { p_driver_id: string }
        Returns: Json
      }
      get_enum_values: {
        Args: { enum_name: string }
        Returns: string[]
      }
      get_latest_driver_location: {
        Args: { p_shipment_id: string }
        Returns: {
          accuracy: number
          driver_id: string
          heading: number
          id: string
          latitude: number
          location_timestamp: string
          longitude: number
          shipment_id: string
          speed: number
        }[]
      }
      get_nearby_shipments: {
        Args: { p_distance_km?: number; p_lat: number; p_lng: number }
        Returns: {
          cargo_type: string | null
          client_id: string
          created_at: string
          delivery_address: string
          delivery_city: string | null
          delivery_date: string | null
          delivery_location: unknown | null
          delivery_notes: string | null
          delivery_state: string | null
          delivery_time_window: unknown | null
          delivery_zip: string | null
          description: string | null
          dimensions: string | null
          dimensions_cm: Json | null
          distance: number | null
          driver_id: string | null
          estimated_distance_km: number | null
          estimated_price: number
          final_price: number | null
          id: string
          is_accident_recovery: boolean | null
          is_fragile: boolean | null
          is_operable: boolean | null
          item_value: number | null
          payment_intent_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_address: string
          pickup_city: string | null
          pickup_date: string | null
          pickup_location: unknown | null
          pickup_notes: string | null
          pickup_state: string | null
          pickup_time_window: unknown | null
          pickup_zip: string | null
          price: number | null
          status: Database["public"]["Enums"]["shipment_status"]
          terms_accepted: boolean | null
          title: string
          updated_at: string
          updated_by: string | null
          vehicle_count: number | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: string | null
          vehicle_year: number | null
          weight: number | null
          weight_kg: number | null
        }[]
      }
      get_proj4_from_srid: {
        Args: { "": number }
        Returns: string
      }
      get_table_columns: {
        Args: { table_name: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: boolean
        }[]
      }
      get_table_names: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_unread_message_count: {
        Args: { p_shipment_id?: string; p_user_id?: string }
        Returns: number
      }
      get_user_conversations_v2: {
        Args: { p_user_id?: string }
        Returns: Json
      }
      gettransactionid: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      gidx_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gidx_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_shipment_available_for_application: {
        Args: { p_shipment_id: string }
        Returns: boolean
      }
      json: {
        Args: { "": unknown }
        Returns: Json
      }
      jsonb: {
        Args: { "": unknown }
        Returns: Json
      }
      longtransactionsenabled: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      mark_message_as_read_v2: {
        Args: { p_message_id: string }
        Returns: boolean
      }
      mark_message_read: {
        Args: { p_message_id: string }
        Returns: boolean
      }
      mark_shipment_messages_read: {
        Args: { p_shipment_id: string }
        Returns: number
      }
      path: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_asflatgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_geometry_clusterintersecting_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_clusterwithin_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_collect_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_makeline_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_polygonize_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      point: {
        Args: { "": unknown }
        Returns: unknown
      }
      polygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      populate_geometry_columns: {
        Args:
          | { tbl_oid: unknown; use_typmod?: boolean }
          | { use_typmod?: boolean }
        Returns: string
      }
      postgis_addbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_dropbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_extensions_upgrade: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_full_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_geos_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_geos_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_getbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_hasbbox: {
        Args: { "": unknown }
        Returns: boolean
      }
      postgis_index_supportfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_lib_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_revision: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libjson_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_liblwgeom_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libprotobuf_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libxml_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_proj_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_installed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_released: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_svn_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_typmod_dims: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_srid: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_type: {
        Args: { "": number }
        Returns: string
      }
      postgis_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_wagyu_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      register_push_token: {
        Args: { p_device_type: string; p_token: string }
        Returns: undefined
      }
      send_message_v2: {
        Args: {
          p_content: string
          p_conversation_id: string
          p_message_type?: string
        }
        Returns: Json
      }
      spheroid_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      spheroid_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlength: {
        Args: { "": unknown }
        Returns: number
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dperimeter: {
        Args: { "": unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle: {
        Args:
          | { line1: unknown; line2: unknown }
          | { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
        Returns: number
      }
      st_area: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_area2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_asbinary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_asewkt: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asgeojson: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; options?: number }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
          | {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
        Returns: string
      }
      st_asgml: {
        Args:
          | { "": string }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_ashexewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_askml: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
          | { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
        Returns: string
      }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: {
        Args: { format?: string; geom: unknown }
        Returns: string
      }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; rel?: number }
          | { geom: unknown; maxdecimaldigits?: number; rel?: number }
        Returns: string
      }
      st_astext: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_astwkb: {
        Args:
          | {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
          | {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
        Returns: string
      }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_boundary: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer: {
        Args:
          | { geom: unknown; options?: string; radius: number }
          | { geom: unknown; quadsegs: number; radius: number }
        Returns: unknown
      }
      st_buildarea: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_centroid: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      st_cleangeometry: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_clusterintersecting: {
        Args: { "": unknown[] }
        Returns: unknown[]
      }
      st_collect: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collectionextract: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_collectionhomogenize: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_convexhull: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_coorddim: {
        Args: { geometry: unknown }
        Returns: number
      }
      st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_dimension: {
        Args: { "": unknown }
        Returns: number
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance: {
        Args:
          | { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_distancesphere: {
        Args:
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; radius: number }
        Returns: number
      }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dump: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumppoints: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumprings: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumpsegments: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_endpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_envelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_expand: {
        Args:
          | { box: unknown; dx: number; dy: number }
          | { box: unknown; dx: number; dy: number; dz?: number }
          | { dm?: number; dx: number; dy: number; dz?: number; geom: unknown }
        Returns: unknown
      }
      st_exteriorring: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_flipcoordinates: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force3d: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_forcecollection: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcecurve: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygonccw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygoncw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcerhr: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcesfs: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_generatepoints: {
        Args:
          | { area: unknown; npoints: number }
          | { area: unknown; npoints: number; seed: number }
        Returns: unknown
      }
      st_geogfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geogfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geographyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geohash: {
        Args:
          | { geog: unknown; maxchars?: number }
          | { geom: unknown; maxchars?: number }
        Returns: string
      }
      st_geomcollfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomcollfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometrytype: {
        Args: { "": unknown }
        Returns: string
      }
      st_geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromgeojson: {
        Args: { "": Json } | { "": Json } | { "": string }
        Returns: unknown
      }
      st_geomfromgml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromkml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfrommarc21: {
        Args: { marc21xml: string }
        Returns: unknown
      }
      st_geomfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromtwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_gmltosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_hasarc: {
        Args: { geometry: unknown }
        Returns: boolean
      }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_isclosed: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_iscollection: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isempty: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygonccw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygoncw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isring: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_issimple: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvalid: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
      }
      st_isvalidreason: {
        Args: { "": unknown }
        Returns: string
      }
      st_isvalidtrajectory: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_length: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_length2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_letters: {
        Args: { font?: Json; letters: string }
        Returns: unknown
      }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefrommultipoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_linefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linemerge: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linestringfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linetocurve: {
        Args: { geometry: unknown }
        Returns: unknown
      }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_m: {
        Args: { "": unknown }
        Returns: number
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makepolygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { "": unknown } | { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_maximuminscribedcircle: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_memsize: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_minimumboundingradius: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_minimumclearance: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumclearanceline: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_mlinefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mlinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multi: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_multilinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multilinestringfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_ndims: {
        Args: { "": unknown }
        Returns: number
      }
      st_node: {
        Args: { g: unknown }
        Returns: unknown
      }
      st_normalize: {
        Args: { geom: unknown }
        Returns: unknown
      }
      st_npoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_nrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numgeometries: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorring: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpatches: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_orientedenvelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { "": unknown } | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_perimeter2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_pointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointonsurface: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_points: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonize: {
        Args: { "": unknown[] }
        Returns: unknown
      }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: string
      }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_reverse: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid: {
        Args: { geog: unknown; srid: number } | { geom: unknown; srid: number }
        Returns: unknown
      }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shiftlongitude: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid: {
        Args: { geog: unknown } | { geom: unknown }
        Returns: number
      }
      st_startpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_summary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_transform: {
        Args:
          | { from_proj: string; geom: unknown; to_proj: string }
          | { from_proj: string; geom: unknown; to_srid: number }
          | { geom: unknown; to_proj: string }
        Returns: unknown
      }
      st_triangulatepolygon: {
        Args: { g1: unknown }
        Returns: unknown
      }
      st_union: {
        Args:
          | { "": unknown[] }
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; gridsize: number }
        Returns: unknown
      }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_wkbtosql: {
        Args: { wkb: string }
        Returns: unknown
      }
      st_wkttosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      st_x: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmin: {
        Args: { "": unknown }
        Returns: number
      }
      st_y: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymax: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymin: {
        Args: { "": unknown }
        Returns: number
      }
      st_z: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmflag: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmin: {
        Args: { "": unknown }
        Returns: number
      }
      table_exists: {
        Args: { table_name: string }
        Returns: boolean
      }
      text: {
        Args: { "": unknown }
        Returns: string
      }
      unlockrows: {
        Args: { "": string }
        Returns: number
      }
      update_application_status: {
        Args: { p_application_id: string; p_notes?: string; p_status: string }
        Returns: {
          applied_at: string | null
          created_at: string | null
          driver_id: string
          id: string
          notes: string | null
          responded_at: string | null
          shipment_id: string
          status: string | null
          updated_at: string | null
        }[]
      }
      update_driver_settings: {
        Args: { p_driver_id: string; p_settings: Json }
        Returns: Json
      }
      update_payment_status: {
        Args: {
          p_metadata?: Json
          p_payment_id: string
          p_payment_intent_client_secret?: string
          p_payment_intent_id?: string
          p_status: Database["public"]["Enums"]["payment_status"]
        }
        Returns: {
          amount: number
          booking_timestamp: string | null
          client_id: string
          created_at: string
          id: string
          initial_amount: number | null
          is_refundable: boolean | null
          metadata: Json | null
          parent_payment_id: string | null
          payment_intent_client_secret: string | null
          payment_intent_id: string | null
          payment_method: string | null
          payment_type: string | null
          refund_deadline: string | null
          refund_id: string | null
          remaining_amount: number | null
          shipment_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }[]
      }
      update_shipment_payment_status: {
        Args: { p_payment_status: string; p_shipment_id: string }
        Returns: undefined
      }
      update_shipment_status: {
        Args: { p_driver_id: string; p_shipment_id: string; p_status: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      verify_driver: {
        Args: { p_driver_id: string }
        Returns: boolean
      }
    }
    Enums: {
      payment_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      shipment_status:
        | "draft"
        | "pending"
        | "accepted"
        | "assigned"
        | "in_transit"
        | "in_progress"
        | "delivered"
        | "completed"
        | "cancelled"
        | "picked_up"
        | "open"
      tracking_event_type:
        | "created"
        | "accepted"
        | "pickup"
        | "in_transit"
        | "delivery"
        | "cancelled"
        | "delayed"
      user_role: "client" | "driver" | "admin"
      vehicle_type: "car" | "van" | "truck" | "motorcycle"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown | null
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      payment_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      shipment_status: [
        "draft",
        "pending",
        "accepted",
        "assigned",
        "in_transit",
        "in_progress",
        "delivered",
        "completed",
        "cancelled",
        "picked_up",
        "open",
      ],
      tracking_event_type: [
        "created",
        "accepted",
        "pickup",
        "in_transit",
        "delivery",
        "cancelled",
        "delayed",
      ],
      user_role: ["client", "driver", "admin"],
      vehicle_type: ["car", "van", "truck", "motorcycle"],
    },
  },
} as const
