// Example showing how to use the real-time hooks in a ShipmentDetailsScreen component
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Button, TextInput } from 'react-native';
import { useRealtimeShipment } from '../hooks/useRealtimeShipment';
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { useDriverLocation } from '../hooks/useDriverLocation';
import { supabase } from '../lib/supabase';
import MapView, { Marker, Region } from 'react-native-maps';

// For example purposes, we'll simulate the auth context
const useAuth = () => {
  const [user] = useState({ id: 'example-user-id' });
  return { user };
};

// These would be your actual components in a real implementation
// For this example, we'll create simple placeholder components
const MessageBubble = ({ message, isOwnMessage, onPress }: { message: any, isOwnMessage: boolean, onPress: () => void }) => (
  <View style={{ backgroundColor: isOwnMessage ? '#DCF8C6' : '#ECECEC', padding: 10, margin: 5, borderRadius: 10 }}>
    <Text>{message.content}</Text>
    <Text style={{ fontSize: 10 }}>{message.is_read ? 'Read' : 'Unread'}</Text>
  </View>
);

const TrackingEvent = ({ event }: { event: any }) => (
  <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#ECECEC' }}>
    <Text style={{ fontWeight: 'bold' }}>{event.event_type}</Text>
    <Text>{new Date(event.created_at).toLocaleString()}</Text>
    {event.notes && <Text>{event.notes}</Text>}
  </View>
);

// Type definitions for props
interface ShipmentDetailsScreenProps {
  route: {
    params: {
      shipmentId: string;
    }
  };
  navigation: any;
}

export default function ShipmentDetailsScreen({ route, navigation }: ShipmentDetailsScreenProps) {
  const { shipmentId } = route.params;
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const mapRef = useRef<MapView>(null);
  
  // Get user role to determine if they're a driver or client
  const [userRole, setUserRole] = useState<string | null>(null);
  
  useEffect(() => {
    const getUserRole = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
        
      if (data) {
        setUserRole(data.role);
      }
    };
    
    getUserRole();
  }, [user]);
  
  // Use the shipment hook to get real-time shipment updates
  const { 
    shipment, 
    trackingEvents 
  } = useRealtimeShipment(shipmentId);
  
  // Use the messages hook for real-time messaging
  const { 
    messages, 
    loading: messagesLoading, 
    sendMessage, 
    markAsRead 
  } = useRealtimeMessages(shipmentId);
  
  // Use the driver location hook - different behavior based on role
  const isDriver = userRole === 'driver';
  const { 
    driverLocation,
    isTracking,
    startTracking,
    stopTracking
  } = useDriverLocation({
    shipmentId,
    isDriver,
    driverId: isDriver ? user?.id : undefined
  });
  
  // Start/stop tracking based on shipment status (for drivers)
  useEffect(() => {
    if (!isDriver || !shipment) return;
    
    if (shipment.status === 'in_transit') {
      startTracking();
    } else if (['delivered', 'cancelled'].includes(shipment.status)) {
      stopTracking();
    }
    
    // Cleanup when unmounting
    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, [isDriver, shipment?.status]);
  
  // Update map when driver location changes
  useEffect(() => {
    if (driverLocation && mapRef.current) {
      const region: Region = {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      mapRef.current.animateToRegion(region);
    }
  }, [driverLocation]);
  
  const handleSendMessage = () => {
    if (messageText.trim() && user?.id) {
      sendMessage(messageText, user.id);
      setMessageText('');
    }
  };
  
  if (!shipment) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading shipment details...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Shipment details section */}
      <View style={styles.detailsContainer}>
        <Text style={styles.title}>{shipment.title}</Text>
        <Text style={styles.status}>Status: {shipment.status}</Text>
        
        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>Pickup:</Text>
          <Text>{shipment.pickup_address}</Text>
        </View>
        
        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>Delivery:</Text>
          <Text>{shipment.delivery_address}</Text>
        </View>
      </View>
      
      {/* Location tracking section - only show if in_transit */}
      {shipment.status === 'in_transit' && (
        <View style={styles.mapContainer}>
          <Text style={styles.sectionTitle}>
            {isDriver ? 'Your Location' : 'Driver Location'}
          </Text>
          
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: 37.78825,
              longitude: -122.4324,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            {driverLocation && (
              <Marker
                coordinate={{
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                }}
                title={isDriver ? 'Your Location' : 'Driver Location'}
                description={`Last updated: ${new Date(driverLocation.location_timestamp).toLocaleTimeString()}`}
              />
            )}
          </MapView>
          
          {isDriver && (
            <Text style={styles.trackingStatus}>
              Location Tracking: {isTracking ? 'Active' : 'Inactive'}
            </Text>
          )}
        </View>
      )}
      
      {/* Tracking events section */}
      <View style={styles.trackingContainer}>
        <Text style={styles.sectionTitle}>Tracking Events</Text>
        {trackingEvents.length === 0 ? (
          <Text>No tracking events yet.</Text>
        ) : (
          <FlatList
            data={trackingEvents}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <TrackingEvent event={item} />}
          />
        )}
      </View>
      
      {/* Messages section */}
      <View style={styles.messagesContainer}>
        <Text style={styles.sectionTitle}>Messages</Text>
        
        {messagesLoading ? (
          <ActivityIndicator size="small" color="#0000ff" />
        ) : messages.length === 0 ? (
          <Text>No messages yet.</Text>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwnMessage={item.sender_id === user?.id}
                onPress={() => !item.is_read && item.sender_id !== user?.id && markAsRead(item.id)}
              />
            )}
          />
        )}
        
        <View style={styles.messageInputContainer}>
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            style={styles.messageInput}
          />
          <Button title="Send" onPress={handleSendMessage} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
    color: '#007AFF',
  },
  addressContainer: {
    marginBottom: 12,
  },
  addressLabel: {
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  mapContainer: {
    marginBottom: 20,
    height: 250,
  },
  map: {
    flex: 1,
    borderRadius: 8,
  },
  trackingStatus: {
    marginTop: 8,
    fontStyle: 'italic',
  },
  trackingContainer: {
    marginBottom: 20,
    maxHeight: 150,
  },
  messagesContainer: {
    flex: 1,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
  },
});
