export * from './user';
export * from './shipment';

// Common API response type
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Common dashboard statistics
export interface DashboardStats {
  totalShipments: number;
  pendingShipments: number;
  activeShipments: number;
  completedShipments: number;
  totalDrivers: number;
  activeDrivers: number;
}

// Common location type
export interface Location {
  latitude: number;
  longitude: number;
}

// Common address type  
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}
