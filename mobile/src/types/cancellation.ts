/**
 * Cancellation Types
 * Types for shipment cancellation and refund system
 */

export type CancellationType = 
  | 'before_acceptance'
  | 'after_acceptance_before_pickup'
  | 'at_pickup_mismatch'
  | 'at_pickup_fraud'
  | 'in_transit'
  | 'force_majeure';

export type CancellationInitiator = 'client' | 'driver' | 'admin' | 'system';

/**
 * Cancellation record with financial breakdown
 */
export interface CancellationRecord {
  id: string;
  shipmentId: string;
  
  // Who and why
  initiatedBy: CancellationInitiator;
  initiatorId?: string;
  cancellationType: CancellationType;
  reason: string;
  fraudConfirmed: boolean;
  
  // Financial breakdown
  originalAmount: number;
  refundToClient: number;
  compensationToDriver: number;
  platformFee: number;
  processingFee: number;
  
  // Refund status
  refundStatus: RefundStatus;
  refundProcessedAt?: string;
  stripeRefundId?: string;
  stripeTransferId?: string;
  
  // Evidence
  pickupVerificationId?: string;
  evidenceUrls?: string[];
  adminNotes?: string;
  
  // Timestamps
  cancelledAt: string;
  createdAt: string;
  updatedAt: string;
}

export type RefundStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'disputed';

/**
 * Request to cancel a shipment
 */
export interface CancelShipmentRequest {
  shipmentId: string;
  cancellationType: CancellationType;
  reason: string;
  pickupVerificationId?: string;
  evidenceUrls?: string[];
  fraudConfirmed?: boolean;
}

/**
 * Cancellation policy details for a given type
 */
export interface CancellationPolicy {
  type: CancellationType;
  clientRefundPercent: number;
  driverCompensationPercent: number;
  platformFeePercent: number;
  description: string;
  allowedBy: CancellationInitiator[];
}

/**
 * All cancellation policies
 */
export const cancellationPolicies: Record<CancellationType, CancellationPolicy> = {
  before_acceptance: {
    type: 'before_acceptance',
    clientRefundPercent: 100,
    driverCompensationPercent: 0,
    platformFeePercent: 0,
    description: 'Full refund if cancelled before driver accepts',
    allowedBy: ['client', 'admin'],
  },
  
  after_acceptance_before_pickup: {
    type: 'after_acceptance_before_pickup',
    clientRefundPercent: 80,
    driverCompensationPercent: 10,
    platformFeePercent: 10,
    description: '80% refund, 10% to driver, 10% platform fee',
    allowedBy: ['client', 'driver', 'admin'],
  },
  
  at_pickup_mismatch: {
    type: 'at_pickup_mismatch',
    clientRefundPercent: 70,
    driverCompensationPercent: 20,
    platformFeePercent: 10,
    description: '70% refund if vehicle doesn\'t match description',
    allowedBy: ['driver', 'client', 'admin'],
  },
  
  at_pickup_fraud: {
    type: 'at_pickup_fraud',
    clientRefundPercent: 0,
    driverCompensationPercent: 40,
    platformFeePercent: 60,
    description: 'No refund if fraud detected, 40% to driver',
    allowedBy: ['driver', 'admin'],
  },
  
  in_transit: {
    type: 'in_transit',
    clientRefundPercent: 50,
    driverCompensationPercent: 40,
    platformFeePercent: 10,
    description: '50% refund if cancelled during transit',
    allowedBy: ['admin'],
  },
  
  force_majeure: {
    type: 'force_majeure',
    clientRefundPercent: 90,
    driverCompensationPercent: 5,
    platformFeePercent: 5,
    description: '90% refund for uncontrollable circumstances',
    allowedBy: ['admin', 'system'],
  },
};

/**
 * Calculate refund breakdown for a cancellation
 */
export function calculateCancellationRefund(
  originalAmount: number,
  cancellationType: CancellationType,
  fraudConfirmed: boolean = false
): {
  clientRefund: number;
  driverCompensation: number;
  platformFee: number;
} {
  // If fraud confirmed, use fraud policy regardless of type
  const policy = fraudConfirmed 
    ? cancellationPolicies.at_pickup_fraud
    : cancellationPolicies[cancellationType];
  
  const clientRefund = (originalAmount * policy.clientRefundPercent) / 100;
  const driverCompensation = (originalAmount * policy.driverCompensationPercent) / 100;
  const platformFee = (originalAmount * policy.platformFeePercent) / 100;
  
  return {
    clientRefund: Math.round(clientRefund * 100) / 100,
    driverCompensation: Math.round(driverCompensation * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
  };
}

/**
 * Check if user can cancel shipment at current status
 */
export function canCancelShipment(
  shipmentStatus: string,
  userRole: 'client' | 'driver' | 'admin'
): boolean {
  // Admin can always cancel
  if (userRole === 'admin') return true;
  
  // Client can cancel before pickup
  if (userRole === 'client') {
    return ['pending', 'accepted', 'driver_en_route', 'driver_arrived'].includes(shipmentStatus);
  }
  
  // Driver can cancel before pickup or during verification
  if (userRole === 'driver') {
    return [
      'accepted',
      'driver_en_route',
      'driver_arrived',
      'pickup_verification_pending',
    ].includes(shipmentStatus);
  }
  
  return false;
}

/**
 * Get cancellation type based on shipment status
 */
export function getCancellationType(shipmentStatus: string): CancellationType {
  switch (shipmentStatus) {
    case 'pending':
      return 'before_acceptance';
    
    case 'accepted':
    case 'driver_en_route':
    case 'driver_arrived':
      return 'after_acceptance_before_pickup';
    
    case 'pickup_verification_pending':
    case 'pickup_verified':
      return 'at_pickup_mismatch';
    
    case 'picked_up':
    case 'in_transit':
      return 'in_transit';
    
    default:
      return 'after_acceptance_before_pickup';
  }
}

/**
 * Format cancellation type for display
 */
export function formatCancellationType(type: CancellationType): string {
  switch (type) {
    case 'before_acceptance':
      return 'Before Driver Assignment';
    case 'after_acceptance_before_pickup':
      return 'Before Pickup';
    case 'at_pickup_mismatch':
      return 'At Pickup - Mismatch';
    case 'at_pickup_fraud':
      return 'At Pickup - Fraud';
    case 'in_transit':
      return 'During Transit';
    case 'force_majeure':
      return 'Force Majeure';
    default:
      return 'Unknown';
  }
}

/**
 * Format refund status for display
 */
export function formatRefundStatus(status: RefundStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing...';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'disputed':
      return 'Disputed';
    default:
      return 'Unknown';
  }
}

/**
 * Get refund status color
 */
export function getRefundStatusColor(status: RefundStatus): string {
  switch (status) {
    case 'pending':
      return '#FFB74D'; // Orange
    case 'processing':
      return '#64B5F6'; // Blue
    case 'completed':
      return '#4CAF50'; // Green
    case 'failed':
      return '#F44336'; // Red
    case 'disputed':
      return '#FF9800'; // Dark Orange
    default:
      return '#9E9E9E'; // Grey
  }
}

/**
 * Cancellation reason templates
 */
export const cancellationReasonTemplates: Record<CancellationInitiator, string[]> = {
  client: [
    'Changed my mind',
    'Found another driver',
    'Vehicle no longer needs transport',
    'Pickup date changed',
    'Price too high',
    'Other',
  ],
  
  driver: [
    'Vehicle doesn\'t match description',
    'Safety concerns',
    'Discovered damage not in photos',
    'Client unavailable at pickup',
    'Route no longer feasible',
    'Other',
  ],
  
  admin: [
    'Fraudulent activity detected',
    'Payment issue',
    'Safety violation',
    'Terms of service violation',
    'Force majeure',
    'Other',
  ],
  
  system: [
    'Payment failed',
    'No driver found within timeframe',
    'Automatic cancellation - no response',
  ],
};

/**
 * Helper to check if cancellation requires verification
 */
export function requiresVerification(type: CancellationType): boolean {
  return [
    'at_pickup_mismatch',
    'at_pickup_fraud',
  ].includes(type);
}

/**
 * Helper to check if cancellation requires admin approval
 */
export function requiresAdminApproval(type: CancellationType): boolean {
  return [
    'at_pickup_fraud',
    'in_transit',
    'force_majeure',
  ].includes(type);
}
