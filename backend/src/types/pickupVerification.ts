/**
 * Pickup Verification Types
 * Backend types for driver pickup verification system
 */

export type VerificationDecision = 'matches' | 'minor_differences' | 'major_issues' | 'pending';
export type VerificationStatus = 'pending' | 'approved_by_client' | 'disputed_by_client' | 'cancelled';
export type ClientResponse = 'approved' | 'disputed' | 'no_response';

export type CancellationType = 
  | 'before_driver_accepts'
  | 'after_accept_before_arrival'
  | 'at_pickup_mismatch'
  | 'at_pickup_fraud'
  | 'in_transit_emergency'
  | 'admin_intervention';

export type CancellationStage = 
  | 'pending'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'pickup_verified'
  | 'picked_up'
  | 'in_transit'
  | 'delivered';

export type ReasonCategory = 
  | 'vehicle_mismatch'
  | 'not_drivable'
  | 'significant_damage'
  | 'wrong_vehicle'
  | 'safety_concern'
  | 'client_fraud'
  | 'driver_no_show'
  | 'client_request'
  | 'emergency'
  | 'other';

export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface VerificationPhoto {
  id: string;
  url: string;
  angle: PhotoAngle;
  timestamp: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export type PhotoAngle = 
  | 'front'
  | 'rear'
  | 'driver_side'
  | 'passenger_side'
  | 'front_driver_quarter'
  | 'front_passenger_quarter'
  | 'rear_driver_quarter'
  | 'rear_passenger_quarter'
  | 'dashboard'
  | 'interior'
  | 'odometer'
  | 'damage_closeup';

export interface VerificationDifference {
  id: string;
  type: DifferenceType;
  severity: 'minor' | 'major';
  description: string;
  affectedArea: string;
  driverPhoto?: string;
  clientPhoto?: string;
}

export type DifferenceType = 
  | 'new_damage'
  | 'missing_item'
  | 'incorrect_vehicle'
  | 'cleanliness_issue'
  | 'mechanical_issue'
  | 'cosmetic_damage'
  | 'tire_condition'
  | 'other';

export interface PickupVerification {
  id: string;
  shipment_id: string;
  driver_id: string;
  
  // Location
  pickup_location: {
    type: 'Point';
    coordinates: [number, number];
  };
  pickup_address_verified: boolean;
  gps_accuracy_meters?: number;
  distance_from_address_meters?: number;
  
  // Photos
  driver_photos: VerificationPhoto[];
  client_photos_reference: VerificationPhoto[];
  comparison_notes?: Record<string, string>;
  
  // Decision
  verification_status: VerificationDecision;
  differences_description?: string;
  cannot_proceed_reason?: string;
  
  // Client response
  client_notified_at?: string;
  client_response?: ClientResponse;
  client_response_notes?: string;
  client_responded_at?: string;
  
  // Timestamps
  arrival_time: string;
  verification_started_at?: string;
  verification_completed_at?: string;
  
  // Metadata
  app_version?: string;
  device_info?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CancellationRecord {
  id: string;
  shipment_id: string;
  cancelled_by: string;
  canceller_role: 'client' | 'driver' | 'admin';
  
  // Type & Timing
  cancellation_type: CancellationType;
  cancellation_stage: CancellationStage;
  
  // Reason
  reason_category: ReasonCategory;
  reason_description: string;
  evidence_photos?: string[];
  pickup_verification_id?: string;
  
  // Financial
  original_amount: number;
  client_refund_amount: number;
  driver_compensation_amount: number;
  platform_fee_amount: number;
  
  // Refund processing
  refund_status: RefundStatus;
  refund_processed_at?: string;
  refund_transaction_id?: string;
  payment_status_before_cancel?: string;
  
  // Admin review
  requires_admin_review: boolean;
  admin_reviewed: boolean;
  admin_reviewer_id?: string;
  admin_notes?: string;
  reviewed_at?: string;
  fraud_confirmed: boolean;
  user_banned: boolean;
  
  // Timestamps
  cancelled_at: string;
  created_at: string;
  updated_at: string;
}

// Request/Response DTOs

export interface StartVerificationRequest {
  shipmentId: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
}

export interface UploadPhotoRequest {
  verificationId: string;
  angle: PhotoAngle;
  photo: any; // Multer file object
  location: {
    lat: number;
    lng: number;
  };
}

export interface SubmitVerificationRequest {
  verificationId: string;
  decision: VerificationDecision;
  differences?: VerificationDifference[];
  driverNotes?: string;
  location: {
    lat: number;
    lng: number;
  };
}

export interface ClientVerificationResponse {
  verificationId: string;
  response: 'approved' | 'disputed';
  notes?: string;
}

export interface CancelShipmentRequest {
  cancellationType: CancellationType;
  reason: string;
  pickupVerificationId?: string;
  evidenceUrls?: string[];
  fraudConfirmed?: boolean;
}

export interface RefundCalculation {
  client_refund: number;
  driver_compensation: number;
  platform_fee: number;
}

export interface StatusUpdateRequest {
  status: 'picked_up' | 'in_transit' | 'delivered';
  notes?: string;
  location?: {
    lat: number;
    lng: number;
  };
  deliveryPhotos?: string[];
}
