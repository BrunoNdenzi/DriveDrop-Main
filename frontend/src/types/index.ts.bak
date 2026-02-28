// Shared TypeScript interfaces for DriveDrop frontend
// This file contains the core types used across the application

/**
 * Standard API response wrapper for all service calls
 */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
  message?: string;
}

/**
 * Geographic location with coordinates and address
 */
export interface Location {
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

/**
 * Dashboard statistics for admin and analytics
 */
export interface DashboardStats {
  total_shipments: number;
  active_shipments: number;
  completed_shipments: number;
  revenue: number;
  driver_count: number;
  client_count: number;
  pending_assignments: number;
}

/**
 * User roles in the DriveDrop system
 */
export type UserRole = 'client' | 'driver' | 'admin';

/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Shipment status types
 */
export type ShipmentStatus = 
  | 'draft'
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'failed';

/**
 * Core shipment data structure
 */
export interface Shipment {
  id: string;
  client_id: string;
  driver_id?: string;
  status: ShipmentStatus;
  title: string;
  description?: string;
  pickup_location: Location;
  delivery_location: Location;
  estimated_price: number;
  actual_price?: number;
  weight_kg?: number;
  dimensions_cm?: {
    length: number;
    width: number;
    height: number;
  };
  item_value?: number;
  is_fragile?: boolean;
  estimated_distance_km?: number;
  created_at: string;
  updated_at: string;
  pickup_time?: string;
  delivery_time?: string;
}

/**
 * Data structure for creating new shipments
 */
export interface CreateShipmentData {
  title: string;
  description?: string;
  pickup_address: string;
  pickup_notes?: string;
  delivery_address: string;
  delivery_notes?: string;
  weight_kg?: number;
  dimensions_cm?: {
    length: number;
    width: number;
    height: number;
  };
  item_value?: number;
  is_fragile?: boolean;
  estimated_distance_km?: number;
  estimated_price: number;
}

/**
 * Tracking event for shipment progress
 */
export interface TrackingEvent {
  id: string;
  shipment_id: string;
  event_type: 'created' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  description: string;
  location?: Location;
  timestamp: string;
  created_by?: string;
}

/**
 * Filter options for shipment queries
 */
export interface ShipmentFilters {
  status?: ShipmentStatus[];
  date_from?: string;
  date_to?: string;
  client_id?: string;
  driver_id?: string;
  limit?: number;
  offset?: number;
}