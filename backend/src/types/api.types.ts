/**
 * Common API types
 */

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Generic filter parameters
 */
export interface FilterParams {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Combined query parameters
 */
export interface QueryParams extends PaginationParams, FilterParams {}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * User roles
 */
export enum UserRole {
  CLIENT = 'client',
  DRIVER = 'driver',
  ADMIN = 'admin',
}

/**
 * Shipment status
 */
export enum ShipmentStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

/**
 * Vehicle type
 */
export enum VehicleType {
  CAR = 'car',
  VAN = 'van',
  TRUCK = 'truck',
  MOTORCYCLE = 'motorcycle',
}

/**
 * Payment status
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/**
 * Draft shipment data interface
 */
export interface DraftShipmentData {
  client_id: string;
  pickup_location?: unknown;
  delivery_location?: unknown;
  pickup_address?: string;
  delivery_address?: string;
  pickup_city?: string;
  pickup_state?: string;
  pickup_zip?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_zip?: string;
  description?: string;
  vehicle_type?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  distance_miles?: number;
  estimated_price?: number;
  scheduled_pickup?: string;
  pickup_date?: string;
  delivery_date?: string;
  is_accident_recovery?: boolean;
  vehicle_count?: number;
  title?: string;
  pickup_notes?: string;
  delivery_notes?: string;
  weight_kg?: number;
  dimensions_cm?: unknown;
  item_value?: number;
  is_fragile?: boolean;
  cargo_type?: string;
}

/**
 * Complete shipment data interface
 */
export interface CompleteShipmentData extends DraftShipmentData {
  pickup_location: unknown;
  delivery_location: unknown;
  pickup_address: string;
  delivery_address: string;
  description: string;
  title: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
}

/**
 * Shipment completion progress interface
 */
export interface ShipmentProgress {
  completionPercentage: number;
  completedSections: string[];
  missingSections: string[];
  nextRequiredFields: string[];
}

/**
 * Enhanced vehicle types for pricing (simplified)
 */
export enum EnhancedVehicleType {
  SEDAN = 'sedan',
  SUV = 'suv',
  TRUCK = 'truck',
}

/**
 * Delivery urgency types
 */
export enum DeliveryType {
  FLEXIBLE = 'flexible',
  STANDARD = 'standard',
  EXPEDITED = 'expedited',
  ACCIDENT = 'accident',
}

/**
 * Distance tier for pricing
 */
export enum DistanceTier {
  SHORT = 'short',   // < 500 miles
  MID = 'mid',       // 500-1500 miles
  LONG = 'long',     // > 1500 miles
}

/**
 * Pricing request parameters
 */
export interface PricingRequest {
  pickup_zip: string;
  delivery_zip: string;
  vehicle_type: EnhancedVehicleType;
  delivery_type?: DeliveryType;
  pickup_date?: string;
  fuel_price?: number;
  vehicle_count?: number;
  is_accident_recovery?: boolean;
}

/**
 * Pricing breakdown details
 */
export interface PricingBreakdown {
  base_cost: number;
  distance_miles: number;
  rate_per_mile: number;
  distance_tier: DistanceTier;
  vehicle_multiplier: number;
  delivery_type_multiplier: number;
  fuel_adjustment: number;
  urgency_adjustment: number;
  minimum_applied: boolean;
  minimum_amount?: number;
}

/**
 * Pricing response
 */
export interface PricingResponse {
  total: number;
  breakdown: PricingBreakdown;
  quote_id: string;
  expires_at: string;
  confidence_level: 'high' | 'medium' | 'low';
  estimated_pickup_time?: string;
  estimated_delivery_time?: string;
  distance_miles: number;
  fuel_price_used: number;
}

/**
 * Real-time pricing update
 */
export interface RealTimePricingUpdate {
  pricing: PricingResponse;
  is_estimate: boolean;
  last_updated: string;
  factors_affecting_price: string[];
}

/**
 * User vehicle profile
 */
export interface UserVehicle {
  id: string;
  user_id: string;
  vehicle_type: VehicleType;
  make: string;
  model: string;
  year: number;
  color: string | null;
  license_plate: string | null;
  nickname: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Create vehicle request
 */
export interface CreateVehicleRequest {
  vehicle_type: VehicleType;
  make: string;
  model: string;
  year: number;
  color?: string;
  license_plate?: string;
  nickname?: string;
  is_primary?: boolean;
}

/**
 * Update vehicle request
 */
export interface UpdateVehicleRequest {
  vehicle_type?: VehicleType;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  license_plate?: string;
  nickname?: string;
  is_primary?: boolean;
  is_active?: boolean;
}

/**
 * Vehicle selection for shipment
 */
export interface VehicleSelection {
  id?: string; // ID if using saved vehicle
  vehicle_type: VehicleType;
  make: string;
  model: string;
  year: number;
  color?: string;
  license_plate?: string;
  save_for_future?: boolean; // Option to save new vehicle to profile
}
