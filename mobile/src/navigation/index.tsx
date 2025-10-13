import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

import { RootStackParamList, ClientTabParamList, DriverTabParamList } from './types';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Client Screens
import HomeScreen from '../screens/home/HomeScreen';
import ConsolidatedNewShipmentScreen from '../screens/ConsolidatedNewShipmentScreen';
import ShipmentCompletionScreen from '../screens/ShipmentCompletionScreen';
import ShipmentsScreen from '../screens/shipments/ShipmentsScreen';
import ShipmentDetailsScreen from '../screens/shipments/ShipmentDetailsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationTestScreen from '../screens/NotificationTestScreen';

// Driver Screens
import DriverDashboardScreen from '../screens/driver/DriverDashboardScreen';
import AvailableShipmentsScreen from '../screens/driver/AvailableShipmentsScreen';
import MyShipmentsScreen from '../screens/driver/MyShipmentsScreen';
import DriverShipmentDetailsScreen from '../screens/driver/ShipmentDetailsScreen';
import RouteMapScreen from '../screens/driver/RouteMapScreen';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen';

// Messaging Screens (new clean implementation)
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';

// Diagnostic Screens
import NetworkDiagnosticScreen from '../screens/NetworkDiagnosticScreen';

// Booking Screens
import BookingStepCustomerScreen from '../screens/booking/BookingStepCustomerScreen';
import BookingStepVehicleScreen from '../screens/booking/BookingStepVehicleScreen';
import BookingStepPickupScreen from '../screens/booking/BookingStepPickupScreen';
import BookingStepDeliveryScreen from '../screens/booking/BookingStepDeliveryScreen';
import BookingStepTowingScreen from '../screens/booking/BookingStepTowingScreen';
import BookingStepInsuranceScreen from '../screens/booking/BookingStepInsuranceScreen';
import BookingStepVisualScreen from '../screens/booking/BookingStepVisualScreen';
import BookingStepTermsScreen from '../screens/booking/BookingStepTermsScreen';
import BookingStepPaymentScreen from '../screens/booking/BookingStepPaymentScreen';
import BookingPaymentProcessingScreen from '../screens/booking/BookingPaymentProcessingScreen';
import BookingConfirmationScreen from '../screens/booking/BookingConfirmationScreen';

// Import admin screens
import AdminAssignmentScreen from '../screens/admin/AdminAssignmentScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';

// Create navigators
const Stack = createNativeStackNavigator<RootStackParamList>();
const ClientTab = createBottomTabNavigator<ClientTabParamList>();
const DriverTab = createBottomTabNavigator<DriverTabParamList>();

// Client tab navigator
function ClientTabNavigator() {
  return (
    <ClientTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.secondary,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        headerShown: false,
      }}
    >
      <ClientTab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <ClientTab.Screen
        name="Messages"
        component={ConversationsScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="chat" color={color} size={size} />
          ),
        }}
      />
      <ClientTab.Screen
        name="Shipments"
        component={ShipmentsScreen}
        options={{
          tabBarLabel: 'Shipments',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="local-shipping" color={color} size={size} />
          ),
        }}
      />
      <ClientTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'My Profile',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="person" color={color} size={size} />
          ),
        }}
      />
    </ClientTab.Navigator>
  );
}

// Driver tab navigator
function DriverTabNavigator() {
  return (
    <DriverTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.text.secondary,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontWeight: 'bold',
          fontSize: 12,
        },
        headerShown: false,
      }}
    >
      <DriverTab.Screen
        name="Dashboard"
        component={DriverDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="dashboard" color={color} size={size} />
          ),
        }}
      />
      <DriverTab.Screen
        name="AvailableShipments"
        component={AvailableShipmentsScreen}
        options={{
          tabBarLabel: 'Available Shipments',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="search" color={color} size={size} />
          ),
        }}
      />
      <DriverTab.Screen
        name="MyShipments"
        component={MyShipmentsScreen}
        options={{
          tabBarLabel: 'My Shipments',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="assignment" color={color} size={size} />
          ),
        }}
      />
      <DriverTab.Screen
        name="Messages"
        component={ConversationsScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="chat" color={color} size={size} />
          ),
        }}
      />
      <DriverTab.Screen
        name="Profile"
        component={DriverProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialIcons name="person" color={color} size={size} />
          ),
        }}
      />
    </DriverTab.Navigator>
  );
}

// Auth stack navigator
function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

// Root navigator
export default function Navigation() {
  const { user, userProfile, loading } = useAuth();

  // Show loading screen while checking authentication
  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text.primary,
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        {user && userProfile ? (
          // User is signed in - route based on role
          <>
            {/* Route based on role from userProfile - all authentication using Supabase Auth */}
            {userProfile.role === 'client' ? (
              <Stack.Screen
                name="ClientTabs"
                component={ClientTabNavigator}
                options={{ headerShown: false }}
              />
            ) : userProfile.role === 'driver' ? (
              <Stack.Screen
                name="DriverTabs"
                component={DriverTabNavigator}
                options={{ headerShown: false }}
              />
            ) : userProfile.role === 'admin' ? (
              <Stack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={{ title: 'Admin Dashboard', headerShown: false }}
              />
            ) : (
              // Fallback to client if role is unknown
              <Stack.Screen
                name="ClientTabs"
                component={ClientTabNavigator}
                options={{ headerShown: false }}
              />
            )}
            
            <Stack.Screen
              name="AdminAssignment"
              component={AdminAssignmentScreen}
              options={{ title: 'Driver Assignment' }}
            />
            
            <Stack.Screen
              name="ShipmentDetails"
              component={ShipmentDetailsScreen}
              options={{ title: 'Shipment Details' }}
            />
            
            <Stack.Screen
              name="ShipmentDetails_Driver"
              component={DriverShipmentDetailsScreen}
              options={{ title: 'Shipment Details' }}
            />
            
            <Stack.Screen
              name="RouteMap"
              component={RouteMapScreen}
              options={{ title: 'Route Map', headerShown: false }}
            />
            
            {/* Messaging Screens */}
            <Stack.Screen
              name="ChatScreen"
              component={ChatScreen}
              options={{ title: 'Chat' }}
            />
            
            <Stack.Screen
              name="CreateShipment"
              component={ConsolidatedNewShipmentScreen}
              options={{ title: 'Create New Shipment' }}
            />
            
            <Stack.Screen
              name="ShipmentCompletion"
              component={ShipmentCompletionScreen}
              options={{ title: 'Complete Shipment' }}
            />
            
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            
            <Stack.Screen
              name="NotificationTest"
              component={NotificationTestScreen}
              options={{ title: 'Notification Test' }}
            />
            
            {/* Booking Flow Screens */}
            <Stack.Screen
              name="BookingStepCustomer"
              component={BookingStepCustomerScreen}
              options={{ title: 'Book Shipment' }}
            />
            <Stack.Screen
              name="BookingStepVehicle"
              component={BookingStepVehicleScreen}
              options={{ title: 'Vehicle Information' }}
            />
            <Stack.Screen
              name="BookingStepPickup"
              component={BookingStepPickupScreen}
              options={{ title: 'Pickup Details' }}
            />
            <Stack.Screen
              name="BookingStepDelivery"
              component={BookingStepDeliveryScreen}
              options={{ title: 'Delivery Details' }}
            />
            <Stack.Screen
              name="BookingStepTowing"
              component={BookingStepTowingScreen}
              options={{ title: 'Towing & Transport' }}
            />
            <Stack.Screen
              name="BookingStepInsurance"
              component={BookingStepInsuranceScreen}
              options={{ title: 'Insurance & Documents' }}
            />
            <Stack.Screen
              name="BookingStepVisual"
              component={BookingStepVisualScreen}
              options={{ title: 'Visual Documentation' }}
            />
            <Stack.Screen
              name="BookingStepTerms"
              component={BookingStepTermsScreen}
              options={{ title: 'Terms & Authorization' }}
            />
            <Stack.Screen
              name="BookingStepPayment"
              component={BookingStepPaymentScreen}
              options={{ title: 'Payment & Summary' }}
            />
            <Stack.Screen
              name="BookingPaymentProcessing"
              component={BookingPaymentProcessingScreen}
              options={{ title: 'Processing Payment' }}
            />
            <Stack.Screen
              name="BookingConfirmation"
              component={BookingConfirmationScreen}
              options={{ 
                title: 'Booking Confirmed',
                headerLeft: () => null, // Prevent going back
                gestureEnabled: false, // Disable swipe back
              }}
            />
            
            {/* Diagnostic screens */}
            <Stack.Screen
              name="NetworkDiagnostic"
              component={NetworkDiagnosticScreen}
              options={{ title: 'Network Diagnostics' }}
            />
            
            {/* Add other authenticated screens here */}
          </>
        ) : (
          // User is not signed in
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
