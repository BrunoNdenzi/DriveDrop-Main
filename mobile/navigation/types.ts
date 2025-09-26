import { NavigatorScreenParams } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

// Root Stack Navigator Types
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Modal: {
    screen: string;
    params?: any;
  };
};

// Auth Stack Navigator Types
export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: {
    token: string;
  };
};

// Main Tab Navigator Types
export type MainTabParamList = {
  Dashboard: undefined;
  Shipments: NavigatorScreenParams<ShipmentStackParamList>;
  Applications: NavigatorScreenParams<ApplicationStackParamList>;
  Profile: undefined;
  Settings: undefined;
};

// Shipment Stack Navigator Types
export type ShipmentStackParamList = {
  ShipmentList: undefined;
  ShipmentDetails: {
    shipmentId: string;
  };
  NewShipment: undefined;
  EnhancedNewShipment: undefined;
  EditShipment: {
    shipmentId: string;
  };
  TrackShipment: {
    shipmentId: string;
  };
};

// Application Stack Navigator Types
export type ApplicationStackParamList = {
  ApplicationList: undefined;
  ApplicationDetails: {
    applicationId: string;
  };
  NewApplication: undefined;
  EditApplication: {
    applicationId: string;
  };
};

// Navigation Props for Screens
export type ShipmentListNavigationProp = StackNavigationProp<ShipmentStackParamList, 'ShipmentList'>;
export type ShipmentDetailsNavigationProp = StackNavigationProp<ShipmentStackParamList, 'ShipmentDetails'>;
export type NewShipmentNavigationProp = StackNavigationProp<ShipmentStackParamList, 'NewShipment'>;
export type EnhancedNewShipmentNavigationProp = StackNavigationProp<ShipmentStackParamList, 'EnhancedNewShipment'>;

// Route Props for Screens
export type ShipmentDetailsRouteProp = RouteProp<ShipmentStackParamList, 'ShipmentDetails'>;
export type EditShipmentRouteProp = RouteProp<ShipmentStackParamList, 'EditShipment'>;
export type TrackShipmentRouteProp = RouteProp<ShipmentStackParamList, 'TrackShipment'>;

// Combined Props Types
export type ShipmentListProps = {
  navigation: ShipmentListNavigationProp;
};

export type ShipmentDetailsProps = {
  navigation: ShipmentDetailsNavigationProp;
  route: ShipmentDetailsRouteProp;
};

export type NewShipmentProps = {
  navigation: NewShipmentNavigationProp;
};

export type EnhancedNewShipmentProps = {
  navigation: EnhancedNewShipmentNavigationProp;
};

// Auth Screen Props
export type SignInNavigationProp = StackNavigationProp<AuthStackParamList, 'SignIn'>;
export type SignUpNavigationProp = StackNavigationProp<AuthStackParamList, 'SignUp'>;

export type SignInProps = {
  navigation: SignInNavigationProp;
};

export type SignUpProps = {
  navigation: SignUpNavigationProp;
};

// Generic Navigation Types
export type NavigationProp<T extends keyof RootStackParamList> = StackNavigationProp<RootStackParamList, T>;
export type ScreenRouteProp<T extends keyof RootStackParamList> = RouteProp<RootStackParamList, T>;

// Screen Component Props Type Helper
export type ScreenProps<
  ParamList extends Record<string, object | undefined>,
  RouteName extends keyof ParamList
> = {
  navigation: StackNavigationProp<ParamList, RouteName>;
  route: RouteProp<ParamList, RouteName>;
};

// Common Screen Options
export const defaultScreenOptions = {
  headerShown: true,
  headerBackTitleVisible: false,
  headerTitleAlign: 'center' as const,
};

export const modalScreenOptions = {
  ...defaultScreenOptions,
  presentation: 'modal' as const,
  headerLeft: () => null,
};

export const stackScreenOptions = {
  ...defaultScreenOptions,
  headerMode: 'screen' as const,
};