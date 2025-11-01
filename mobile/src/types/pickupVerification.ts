/**
 * Pickup Verification Types
 * Types for driver pickup verification system
 */

export type VerificationDecision = 'matches' | 'minor_differences' | 'major_issues';
export type VerificationStatus = 'pending' | 'approved_by_client' | 'disputed_by_client' | 'cancelled';
export type ClientResponse = 'approved' | 'disputed';

/**
 * Photo taken by driver during pickup verification
 */
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

/**
 * Required photo angles for comprehensive verification
 */
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

/**
 * Documented difference between client and driver photos
 */
export interface VerificationDifference {
  id: string;
  type: DifferenceType;
  severity: 'minor' | 'major';
  description: string;
  affectedArea: string;
  driverPhoto?: string; // URL
  clientPhoto?: string; // URL
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

/**
 * Complete pickup verification record
 */
export interface PickupVerification {
  id: string;
  shipmentId: string;
  driverId: string;
  
  // Photos
  photos: VerificationPhoto[];
  photoCount: number;
  
  // Comparison
  decision: VerificationDecision;
  differences?: VerificationDifference[];
  driverNotes?: string;
  
  // GPS verification
  verificationLocation: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  distanceFromPickup: number; // meters
  
  // Timing
  verificationStartedAt: string;
  verificationCompletedAt?: string;
  
  // Client response (if differences found)
  clientResponse?: ClientResponse;
  clientNotes?: string;
  clientRespondedAt?: string;
  
  // Status
  status: VerificationStatus;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to start pickup verification
 */
export interface StartVerificationRequest {
  shipmentId: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
}

/**
 * Request to submit completed verification
 */
export interface SubmitVerificationRequest {
  verificationId: string;
  photos: {
    angle: PhotoAngle;
    uri: string; // Local URI before upload
  }[];
  decision: VerificationDecision;
  differences?: Omit<VerificationDifference, 'id'>[];
  driverNotes?: string;
  location: {
    lat: number;
    lng: number;
  };
}

/**
 * Client response to verification with differences
 */
export interface ClientVerificationResponse {
  verificationId: string;
  response: ClientResponse;
  notes?: string;
}

/**
 * Helper to check if verification is complete
 */
export function isVerificationComplete(verification: PickupVerification): boolean {
  // Must have minimum photos
  if (verification.photoCount < 6) return false;
  
  // Must have decision
  if (!verification.decision) return false;
  
  // If differences found, must have client response
  if (verification.decision === 'minor_differences' && !verification.clientResponse) {
    return false;
  }
  
  return true;
}

/**
 * Helper to get required photo angles
 */
export function getRequiredPhotoAngles(): PhotoAngle[] {
  return [
    'front',
    'rear',
    'driver_side',
    'passenger_side',
    'front_driver_quarter',
    'front_passenger_quarter',
  ];
}

/**
 * Helper to get remaining required photos
 */
export function getRemainingPhotos(existingPhotos: VerificationPhoto[]): PhotoAngle[] {
  const required = getRequiredPhotoAngles();
  const taken = new Set(existingPhotos.map(p => p.angle));
  return required.filter(angle => !taken.has(angle));
}

/**
 * Helper to check if verification should be auto-cancelled
 */
export function shouldAutoCancelVerification(verification: PickupVerification): boolean {
  // If major issues found
  if (verification.decision === 'major_issues') return true;
  
  // If client disputed minor differences
  if (
    verification.decision === 'minor_differences' &&
    verification.clientResponse === 'disputed'
  ) {
    return true;
  }
  
  return false;
}

/**
 * Helper to format verification status for display
 */
export function formatVerificationStatus(status: VerificationStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending Verification';
    case 'approved_by_client':
      return 'Approved';
    case 'disputed_by_client':
      return 'Disputed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

/**
 * Helper to format verification decision for display
 */
export function formatVerificationDecision(decision: VerificationDecision): string {
  switch (decision) {
    case 'matches':
      return '✅ Vehicle Matches';
    case 'minor_differences':
      return '⚠️ Minor Differences';
    case 'major_issues':
      return '❌ Major Issues';
    default:
      return 'Not Decided';
  }
}

/**
 * Helper to get decision color
 */
export function getDecisionColor(decision: VerificationDecision): string {
  switch (decision) {
    case 'matches':
      return '#4CAF50'; // Green
    case 'minor_differences':
      return '#FF9800'; // Orange
    case 'major_issues':
      return '#F44336'; // Red
    default:
      return '#9E9E9E'; // Grey
  }
}

/**
 * Photo angle labels for UI
 */
export const photoAngleLabels: Record<PhotoAngle, string> = {
  front: 'Front View',
  rear: 'Rear View',
  driver_side: 'Driver Side',
  passenger_side: 'Passenger Side',
  front_driver_quarter: 'Front Driver Quarter',
  front_passenger_quarter: 'Front Passenger Quarter',
  rear_driver_quarter: 'Rear Driver Quarter',
  rear_passenger_quarter: 'Rear Passenger Quarter',
  dashboard: 'Dashboard',
  interior: 'Interior',
  odometer: 'Odometer',
  damage_closeup: 'Damage Close-up',
};

/**
 * Difference type labels for UI
 */
export const differenceTypeLabels: Record<DifferenceType, string> = {
  new_damage: 'New Damage',
  missing_item: 'Missing Item',
  incorrect_vehicle: 'Incorrect Vehicle',
  cleanliness_issue: 'Cleanliness Issue',
  mechanical_issue: 'Mechanical Issue',
  cosmetic_damage: 'Cosmetic Damage',
  tire_condition: 'Tire Condition',
  other: 'Other',
};
