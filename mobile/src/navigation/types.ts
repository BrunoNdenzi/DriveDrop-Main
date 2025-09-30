/**
 * Navigation types for type-safe navigation
 */

export type RootStackParamList = {
  // Auth Stack
  Auth: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  
  // Role-based Tab Navigators
  ClientTabs: { screen?: keyof ClientTabParamList } | undefined;
  DriverTabs: { screen?: keyof DriverTabParamList } | undefined;
  
  // Screens accessible from tabs
  ShipmentDetails: { shipmentId: string };
  ShipmentDetails_Driver: { shipmentId: string }; // Driver view of shipment details
  ShipmentEditor: { shipmentId: string }; // Single-page shipment editor
  RouteMap: { shipmentId: string };
  CreateShipment: undefined;
  ShipmentCompletion: { shipmentData: any };
  Notifications: undefined;
  Settings: undefined;
  
  // Messaging Screens
  MessagingV2: { 
    conversationId?: string; 
    shipmentId?: string; 
    mode?: 'conversation' | 'list';
  };
  
  // Vehicle Management Screens
  VehicleProfiles: undefined;
  AddEditVehicle: { vehicle?: any } | undefined;
  
  // Admin Screens
  AdminAssignment: undefined;
  AdminDashboard: undefined;
  
  // Driver Profile Screens
  EditProfile: undefined;
  VehicleInfo: undefined;
  EarningsHistory: undefined;
  HelpSupport: undefined;
  SecurityPrivacy: undefined;
  
  // Client Profile Screens
  EditClientProfile: undefined;
  PaymentMethods: undefined;
  AddressBook: undefined;
  NotificationSettings: undefined;
  HelpSupportClient: undefined;
  
  // Booking Flow Screens
  BookingStepCustomer: { quoteId?: string };
  BookingStepVehicle: undefined;
  BookingStepPickup: undefined;
  BookingStepDelivery: undefined;
  BookingStepTowing: undefined;
  BookingStepInsurance: undefined;
  BookingStepVisual: undefined;
  BookingStepTerms: undefined;
  BookingStepPayment: undefined;
  BookingPaymentProcessing: { 
    amount: number;
    quote: {
      service: string;
      price: number;
      days: string;
    }
  };
  BookingConfirmation: { shipmentId: string };
};

export type ClientTabParamList = {
  Home: undefined;
  MessagesV2: undefined;
  Shipments: { initialFilter?: 'pending' | 'active' | 'past' } | undefined;
  Profile: undefined;
};

export type DriverTabParamList = {
  Dashboard: undefined;
  AvailableShipments: undefined;
  MyShipments: undefined;
  MessagesV2: undefined;
  Profile: undefined;
};

// Deprecated - keeping for backward compatibility
export type MainTabParamList = ClientTabParamList;
