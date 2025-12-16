// Tour configuration types and interfaces
import { DriveStep } from 'driver.js';

export type TourType = 
  | 'dashboard'
  | 'shipment_creation'
  | 'tracking'
  | 'payment'
  | 'admin'
  | 'broker'
  | 'driver';

export type UserRole = 'client' | 'driver' | 'admin' | 'broker';

export interface OnboardingProgress {
  profile_completed: boolean;
  payment_method_added: boolean;
  first_shipment_created: boolean;
  first_shipment_tracked: boolean;
  documents_uploaded: boolean;
}

export interface UserOnboarding {
  id: string;
  user_id: string;
  dashboard_tour_completed: boolean;
  shipment_creation_tour_completed: boolean;
  tracking_tour_completed: boolean;
  payment_tour_completed: boolean;
  admin_tour_completed: boolean;
  broker_tour_completed: boolean;
  driver_tour_completed: boolean;
  checklist_progress: OnboardingProgress;
  dismissed_hints: string[];
  show_tours: boolean;
  created_at: string;
  updated_at: string;
}

export interface TourConfig {
  tourType: TourType;
  steps: DriveStep[];
  onComplete?: () => void;
}
