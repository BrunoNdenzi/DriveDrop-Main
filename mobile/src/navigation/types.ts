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
  ClientTabs: undefined;
  DriverTabs: undefined;

  // Screens accessible from tabs
  ShipmentDetails: { shipmentId: string };
  ShipmentDetails_Driver: { shipmentId: string }; // Driver view of shipment details
  RouteMap: { shipmentId: string };
  CreateShipment: undefined;
  EditProfile: undefined;
  Notifications: undefined;
  Settings: undefined;
  NotificationTest: undefined;

  // Admin Screens
  AdminAssignment: undefined;
  AdminDashboard: undefined;

  // Diagnostic Screens
  NetworkDiagnostic: undefined;

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
    };
  };
  BookingConfirmation: { shipmentId: string };
};

export type ClientTabParamList = {
  Home: undefined;
  Messages: { contactId?: string };
  Shipments: undefined;
  Profile: undefined;
};

export type DriverTabParamList = {
  Dashboard: undefined;
  AvailableShipments: undefined;
  MyShipments: undefined;
  Messages: { contactId?: string };
  Profile: undefined;
};

// Deprecated - keeping for backward compatibility
export type MainTabParamList = ClientTabParamList;
