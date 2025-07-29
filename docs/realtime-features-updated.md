# Real-time Features Implementation

This document outlines the implementation of real-time features in the DriveDrop application.

## 1. Real-time Shipment Status Updates

### Implementation
- Added real-time Supabase subscriptions to both driver and client shipment detail screens
- Created a singleton RealtimeService to manage all subscriptions
- Implemented database triggers to track status changes
- Added cleanup functions to manage database size
- **NEW**: Created React hooks for easier integration into components

### Using the New Hook
```typescript
// In ShipmentDetailsScreen.tsx
import { useRealtimeShipment } from '../hooks/useRealtimeShipment';

function ShipmentDetailsScreen({ route }) {
  const { shipmentId } = route.params;
  
  // Subscribe to realtime updates with the new hook
  const { 
    shipment, 
    messages, 
    trackingEvents, 
    driverLocation 
  } = useRealtimeShipment(shipmentId);
  
  // Data is now available and will update automatically
  // No need to manually handle subscriptions or cleanup
  
  return (
    <View>
      <Text>Status: {shipment?.status}</Text>
      {/* Other UI elements */}
    </View>
  );
}
```

### Legacy Usage (for reference)
```typescript
// Old approach using the service directly
const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

// Setup subscription
realtimeChannelRef.current = realtimeService.subscribeToShipment(
  shipmentId,
  (updatedShipment) => {
    setShipment(current => ({
        ...current,
        ...updatedShipment
      }));
    },
    // Other handlers...
  );
};
```

## 2. Real-time Messaging

### Implementation
- Enhanced MessagesScreen to use real-time Supabase subscriptions
- Added message read status tracking
- Created database functions to support real-time message delivery
- **NEW**: Created a dedicated hook for real-time messaging

### Using the New Hook
```typescript
// In MessagesScreen.tsx
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { useAuth } from '../context/auth'; // Adjust based on your auth implementation

function MessagesScreen({ route }) {
  const { shipmentId } = route.params;
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  
  // Use the messaging hook to handle real-time updates
  const { 
    messages, 
    loading, 
    error, 
    sendMessage, 
    markAsRead 
  } = useRealtimeMessages(shipmentId);
  
  const handleSend = () => {
    if (messageText.trim() && user?.id) {
      sendMessage(messageText, user.id);
      setMessageText('');
    }
  };
  
  return (
    <View>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={messages}
          renderItem={({ item }) => (
            <MessageBubble 
              message={item} 
              isOwn={item.sender_id === user?.id}
              onPress={() => !item.is_read && markAsRead(item.id)} 
            />
          )}
        />
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
        />
        <Button title="Send" onPress={handleSend} />
      </View>
    </View>
  );
}
```

### Legacy Implementation
```typescript
// Key components still used in the underlying implementation
- Real-time message delivery via Supabase channels
- Immediate UI updates when messages are sent or received
- Read status tracking for better user experience
```

## 3. Driver Location Tracking

### Implementation
- Added driver location tracking using Expo Location
- Created a driver_locations table with proper indexing
- Implemented interval-based location updates (every 30 seconds)
- Added cleanup triggers to manage database size
- **NEW**: Created a dedicated hook for driver location tracking

### Using the New Hook

#### For Drivers
```typescript
// In DeliveryScreen.tsx
import { useDriverLocation } from '../hooks/useDriverLocation';
import { useAuth } from '../context/auth'; // Adjust based on your auth implementation

function DeliveryScreen({ route }) {
  const { shipmentId } = route.params;
  const { user } = useAuth();
  
  // Use the location hook with driver mode
  const { 
    isTracking, 
    error, 
    startTracking, 
    stopTracking 
  } = useDriverLocation({
    shipmentId,
    isDriver: true,
    driverId: user?.id
  });
  
  // Start tracking when shipment status changes to in_transit
  useEffect(() => {
    if (shipment.status === 'in_transit') {
      startTracking();
    } else if (shipment.status === 'delivered') {
      stopTracking();
    }
    
    // Cleanup on unmount
    return () => {
      stopTracking();
    };
  }, [shipment.status]);
  
  return (
    <View>
      <Text>Delivery in progress</Text>
      <Text>Location tracking: {isTracking ? 'Active' : 'Inactive'}</Text>
      {/* Other UI elements */}
    </View>
  );
}
```

#### For Clients
```typescript
// In TrackDeliveryScreen.tsx
import { useDriverLocation } from '../hooks/useDriverLocation';
import MapView, { Marker } from 'react-native-maps';

function TrackDeliveryScreen({ route }) {
  const { shipmentId } = route.params;
  const mapRef = useRef(null);
  
  // Use the location hook in client mode
  const { driverLocation, error } = useDriverLocation({
    shipmentId,
    isDriver: false
  });
  
  // Update map when location changes
  useEffect(() => {
    if (driverLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }
  }, [driverLocation]);
  
  return (
    <View>
      <MapView
        ref={mapRef}
        style={{ width: '100%', height: 300 }}
      >
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            title="Driver Location"
          />
        )}
      </MapView>
    </View>
  );
}
```

### Legacy Usage
```typescript
// Start tracking when shipment status changes to in_transit
if (newStatus === 'in_transit' && userProfile) {
  realtimeService.startLocationTracking(
    shipment.id,
    userProfile.id,
    () => Alert.alert('Location Permission', 'Location permission is required')
  );
}

// Stop tracking when shipment is delivered
if (newStatus === 'delivered') {
  realtimeService.stopLocationTracking();
}

// In client app, subscribe to driver location updates
locationChannelRef.current = realtimeService.subscribeToDriverLocation(
  shipmentId,
  (location) => {
    setDriverLocation(location);
  }
);
```

## Security Considerations

- Added Row Level Security (RLS) policies to ensure data access control
- Drivers can only track their own shipments
- Clients can only see locations for their shipments
- Automatic cleanup of tracking data for privacy
- All subscriptions use proper authentication checks

## Performance Considerations

- Singleton pattern for RealtimeService to prevent duplicate subscriptions
- Careful management of subscription lifecycles
- Interval-based location updates (30s) to balance accuracy and battery usage
- Database triggers for automated cleanup of old tracking data
- New hooks handle subscription cleanup automatically in useEffect cleanup functions

## Next Steps

- Add more extensive error handling for subscription failures
- Implement offline support with retry mechanisms
- Consider adding push notifications for critical status changes
- Explore geofencing to automatically detect arrivals at pickup/delivery locations
- Add additional unit tests for the realtime hooks
