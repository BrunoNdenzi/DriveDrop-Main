// =====================================================
// BROKER INTEGRATION TYPES
// TypeScript definitions for broker-related database tables
// =====================================================

// =====================================================
// ENUMS & CONSTANTS
// =====================================================

export type UserRole = 'client' | 'driver' | 'admin' | 'broker';

export type VerificationStatus = 
  | 'pending' 
  | 'documents_submitted' 
  | 'under_review' 
  | 'verified' 
  | 'rejected' 
  | 'suspended';

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'closed';

export type BusinessStructure = 
  | 'sole_proprietorship' 
  | 'llc' 
  | 'corporation' 
  | 's_corp' 
  | 'partnership';

export type RelationshipStatus = 
  | 'pending' 
  | 'active' 
  | 'inactive' 
  | 'suspended' 
  | 'terminated';

export type AssignmentStatus = 
  | 'pending' 
  | 'accepted' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export type AssignmentType = 'direct' | 'broker_assigned' | 'load_board';

export type LoadVisibility = 'public' | 'invited_only' | 'network_only';

export type LoadStatus = 
  | 'available' 
  | 'pending_acceptance' 
  | 'assigned' 
  | 'cancelled' 
  | 'expired';

export type BidStatus = 
  | 'pending' 
  | 'accepted' 
  | 'rejected' 
  | 'withdrawn' 
  | 'expired';

export type PayoutStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'disputed';

export type PaymentMethod = 
  | 'stripe_transfer' 
  | 'ach' 
  | 'wire' 
  | 'check' 
  | 'paypal';

export type DocumentType = 
  | 'dot_authority' 
  | 'mc_authority' 
  | 'insurance_certificate' 
  | 'surety_bond' 
  | 'business_license' 
  | 'tax_document' 
  | 'fmcsa_license' 
  | 'other';

export type DocumentVerificationStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'expired';

// =====================================================
// BROKER PROFILES
// =====================================================

export interface BrokerProfile {
  id: string;
  profile_id: string; // FK to profiles table
  
  // Company Information
  company_name: string;
  dba_name?: string;
  company_email: string;
  company_phone: string;
  
  // Legal & Compliance
  dot_number?: string; // US DOT Number
  mc_number?: string; // Motor Carrier Number
  tax_id?: string; // EIN or Tax ID
  
  // License & Insurance
  broker_license_number?: string;
  insurance_policy_number?: string;
  insurance_provider?: string;
  insurance_amount?: number;
  insurance_expiry_date?: string; // DATE
  bond_number?: string;
  bond_amount?: number;
  
  // Verification Status
  verification_status: VerificationStatus;
  fmcsa_verified: boolean;
  dot_verified: boolean;
  insurance_verified: boolean;
  verified_at?: string;
  verification_notes?: string;
  
  // Business Details
  business_structure?: BusinessStructure;
  years_in_business?: number;
  website_url?: string;
  
  // Address
  business_address: string;
  business_city: string;
  business_state: string;
  business_zip: string;
  business_country: string;
  
  // Commission & Financials
  default_commission_rate: number; // Percentage
  platform_fee_rate: number; // Percentage
  
  // Performance Metrics
  total_shipments_completed: number;
  total_revenue_generated: number;
  average_rating: number;
  total_ratings: number;
  on_time_delivery_rate: number;
  cancellation_rate: number;
  
  // Carrier Network Stats
  total_carriers: number;
  active_carriers: number;
  
  // Account Status
  account_status: AccountStatus;
  suspension_reason?: string;
  suspended_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Partial type for creating broker profile
export type CreateBrokerProfile = Omit<
  BrokerProfile, 
  | 'id' 
  | 'verification_status' 
  | 'fmcsa_verified' 
  | 'dot_verified' 
  | 'insurance_verified' 
  | 'total_shipments_completed'
  | 'total_revenue_generated'
  | 'average_rating'
  | 'total_ratings'
  | 'on_time_delivery_rate'
  | 'cancellation_rate'
  | 'total_carriers'
  | 'active_carriers'
  | 'account_status'
  | 'created_at'
  | 'updated_at'
>;

// Partial type for updating broker profile
export type UpdateBrokerProfile = Partial<Omit<BrokerProfile, 'id' | 'profile_id' | 'created_at'>>;

// =====================================================
// BROKER CARRIERS
// =====================================================

export interface BrokerCarrier {
  id: string;
  broker_id: string; // FK to broker_profiles
  carrier_id: string; // FK to profiles (driver)
  
  // Relationship Details
  relationship_status: RelationshipStatus;
  invited_by?: string; // 'broker' or 'carrier'
  invitation_accepted_at?: string;
  
  // Commission Agreement
  commission_rate: number; // Percentage
  payment_terms?: string;
  
  // Performance Tracking
  total_shipments_completed: number;
  total_revenue_generated: number;
  average_rating: number;
  on_time_delivery_rate: number;
  last_shipment_date?: string;
  
  // Notes & History
  notes?: string;
  termination_reason?: string;
  terminated_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type CreateBrokerCarrier = Omit<
  BrokerCarrier,
  | 'id'
  | 'relationship_status'
  | 'total_shipments_completed'
  | 'total_revenue_generated'
  | 'average_rating'
  | 'on_time_delivery_rate'
  | 'created_at'
  | 'updated_at'
>;

export type UpdateBrokerCarrier = Partial<Omit<BrokerCarrier, 'id' | 'broker_id' | 'carrier_id' | 'created_at'>>;

// =====================================================
// BROKER ASSIGNMENTS
// =====================================================

export interface BrokerAssignment {
  id: string;
  shipment_id: string; // FK to shipments
  broker_id: string; // FK to broker_profiles
  carrier_id?: string; // FK to profiles (driver)
  broker_carrier_relationship_id?: string; // FK to broker_carriers
  
  // Assignment Details
  assignment_status: AssignmentStatus;
  assignment_type: AssignmentType;
  assigned_at: string;
  accepted_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  
  // Financial Breakdown
  total_amount: number;
  carrier_payout: number;
  broker_commission: number;
  platform_fee: number;
  commission_rate: number; // Percentage
  platform_fee_rate: number; // Percentage
  
  // Performance Tracking
  pickup_on_time?: boolean;
  delivery_on_time?: boolean;
  customer_rating?: number; // 1-5
  customer_feedback?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type CreateBrokerAssignment = Omit<
  BrokerAssignment,
  | 'id'
  | 'assignment_status'
  | 'assigned_at'
  | 'created_at'
  | 'updated_at'
>;

export type UpdateBrokerAssignment = Partial<Omit<BrokerAssignment, 'id' | 'shipment_id' | 'created_at'>>;

// =====================================================
// LOAD BOARD
// =====================================================

export interface LoadBoard {
  id: string;
  shipment_id: string; // FK to shipments
  posted_by: string; // FK to profiles
  
  // Visibility & Access
  visibility: LoadVisibility;
  allowed_brokers?: string[]; // Array of broker IDs
  
  // Load Details
  load_status: LoadStatus;
  expires_at?: string;
  
  // Bidding
  bidding_enabled: boolean;
  reserve_price?: number;
  current_best_bid_id?: string;
  total_bids: number;
  
  // Pricing
  suggested_carrier_payout?: number;
  max_broker_commission?: number;
  
  // Assignment
  assigned_to_broker_id?: string; // FK to broker_profiles
  assigned_to_carrier_id?: string; // FK to profiles
  assigned_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type CreateLoadBoard = Omit<
  LoadBoard,
  | 'id'
  | 'load_status'
  | 'total_bids'
  | 'created_at'
  | 'updated_at'
>;

export type UpdateLoadBoard = Partial<Omit<LoadBoard, 'id' | 'shipment_id' | 'posted_by' | 'created_at'>>;

// =====================================================
// LOAD BOARD BIDS
// =====================================================

export interface LoadBoardBid {
  id: string;
  load_board_id: string; // FK to load_board
  broker_id: string; // FK to broker_profiles
  carrier_id: string; // FK to profiles (driver)
  broker_carrier_relationship_id?: string; // FK to broker_carriers
  
  // Bid Details
  bid_status: BidStatus;
  
  // Financial Proposal
  carrier_payout: number;
  broker_commission: number;
  total_cost: number;
  platform_fee: number;
  commission_rate: number; // Percentage
  
  // Carrier Information
  carrier_name: string;
  carrier_rating?: number;
  carrier_completed_shipments?: number;
  estimated_pickup_date?: string; // DATE
  estimated_delivery_date?: string; // DATE
  
  // Bid Management
  bid_notes?: string;
  expires_at?: string;
  accepted_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  withdrawn_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type CreateLoadBoardBid = Omit<
  LoadBoardBid,
  | 'id'
  | 'bid_status'
  | 'created_at'
  | 'updated_at'
>;

export type UpdateLoadBoardBid = Partial<Omit<LoadBoardBid, 'id' | 'load_board_id' | 'broker_id' | 'created_at'>>;

// =====================================================
// BROKER PAYOUTS
// =====================================================

export interface BrokerPayout {
  id: string;
  broker_id: string; // FK to broker_profiles
  shipment_id: string; // FK to shipments
  assignment_id?: string; // FK to broker_assignments
  
  // Payout Details
  payout_status: PayoutStatus;
  payout_amount: number;
  commission_rate: number; // Percentage
  
  // Payment Information
  payment_method?: PaymentMethod;
  stripe_transfer_id?: string;
  transaction_id?: string;
  
  // Timing
  eligible_for_payout_at?: string;
  processed_at?: string;
  completed_at?: string;
  failed_at?: string;
  failure_reason?: string;
  
  // Dispute Handling
  disputed_at?: string;
  dispute_reason?: string;
  dispute_resolved_at?: string;
  dispute_resolution?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type CreateBrokerPayout = Omit<
  BrokerPayout,
  | 'id'
  | 'payout_status'
  | 'created_at'
  | 'updated_at'
>;

export type UpdateBrokerPayout = Partial<Omit<BrokerPayout, 'id' | 'broker_id' | 'shipment_id' | 'created_at'>>;

// =====================================================
// BROKER DOCUMENTS
// =====================================================

export interface BrokerDocument {
  id: string;
  broker_id: string; // FK to broker_profiles
  
  // Document Details
  document_type: DocumentType;
  document_name: string;
  description?: string;
  
  // Storage
  file_url: string;
  file_name: string;
  file_size?: number; // bytes
  mime_type?: string;
  
  // Verification
  verification_status: DocumentVerificationStatus;
  verified_by?: string; // FK to profiles (admin)
  verified_at?: string;
  rejection_reason?: string;
  
  // Expiry Management
  expiry_date?: string; // DATE
  expiry_reminder_sent: boolean;
  is_expired: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type CreateBrokerDocument = Omit<
  BrokerDocument,
  | 'id'
  | 'verification_status'
  | 'expiry_reminder_sent'
  | 'is_expired'
  | 'created_at'
  | 'updated_at'
>;

export type UpdateBrokerDocument = Partial<Omit<BrokerDocument, 'id' | 'broker_id' | 'created_at'>>;

// =====================================================
// PAYMENT DISTRIBUTION
// =====================================================

export interface PaymentDistribution {
  total: number;
  carrier: number;
  broker: number;
  platform: number;
  broker_rate: number;
  platform_rate: number;
}

// =====================================================
// EXTENDED TYPES (with relationships)
// =====================================================

export interface BrokerProfileWithUser extends BrokerProfile {
  profile?: {
    id: string;
    email: string;
    full_name?: string;
    phone?: string;
  };
}

export interface BrokerCarrierWithDetails extends BrokerCarrier {
  broker?: BrokerProfile;
  carrier?: {
    id: string;
    email: string;
    full_name?: string;
    phone?: string;
  };
}

export interface BrokerAssignmentWithDetails extends BrokerAssignment {
  shipment?: any; // Reference to Shipment type
  broker?: BrokerProfile;
  carrier?: {
    id: string;
    email: string;
    full_name?: string;
    phone?: string;
  };
  load_board?: LoadBoardWithDetails;
}

export interface LoadBoardWithDetails extends LoadBoard {
  shipment?: {
    id: string;
    pickup_city?: string;
    pickup_state?: string;
    pickup_zip?: string;
    delivery_city?: string;
    delivery_state?: string;
    delivery_zip?: string;
    vehicle_type?: string;
    vehicle_year?: string;
    vehicle_make?: string;
    vehicle_model?: string;
    distance?: number;
    pickup_date?: string;
    delivery_date?: string;
  };
  posted_by_user?: {
    id: string;
    email: string;
    full_name?: string;
  };
  bids?: LoadBoardBid[];
}

export interface LoadBoardBidWithDetails extends LoadBoardBid {
  load_board?: LoadBoardWithDetails;
  broker?: BrokerProfile;
  carrier?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

// Extended BrokerPayout with relationships
export interface BrokerPayoutWithDetails extends BrokerPayout {
  broker?: BrokerProfile;
  shipment?: {
    id: string;
    carrier?: {
      id: string;
      email: string;
      full_name?: string;
      phone?: string;
    };
  };
  assignment?: BrokerAssignmentWithDetails;
  load_board?: LoadBoardWithDetails;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface BrokerRegistrationRequest {
  // User profile info
  email: string;
  password: string;
  full_name: string;
  phone: string;
  
  // Broker profile info
  company_name: string;
  company_email: string;
  company_phone: string;
  business_address: string;
  business_city: string;
  business_state: string;
  business_zip: string;
  dot_number?: string;
  mc_number?: string;
  default_commission_rate?: number;
}

export interface InviteCarrierRequest {
  broker_id: string;
  carrier_email: string;
  commission_rate: number;
  payment_terms?: string;
  notes?: string;
}

export interface PlaceBidRequest {
  load_board_id: string;
  broker_id: string;
  carrier_id: string;
  carrier_payout: number;
  broker_commission: number;
  estimated_pickup_date?: string;
  estimated_delivery_date?: string;
  bid_notes?: string;
}

export interface AcceptBidRequest {
  bid_id: string;
  shipment_id: string;
}

export interface BrokerStatsResponse {
  total_shipments: number;
  active_shipments: number;
  total_revenue: number;
  pending_payouts: number;
  total_carriers: number;
  active_carriers: number;
  average_rating: number;
  on_time_rate: number;
}

export interface LoadBoardFilters {
  pickup_state?: string;
  delivery_state?: string;
  vehicle_type?: string;
  min_price?: number;
  max_price?: number;
  pickup_date_from?: string;
  pickup_date_to?: string;
  status?: LoadStatus;
}
