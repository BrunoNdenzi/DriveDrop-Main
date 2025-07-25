// src/screens/NotificationTestScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Button, Card, Divider } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '../contexts/NotificationContext';
import { notificationService } from '../services/NotificationService';
import { realtimeService } from '../services/RealtimeService';
import { offlineService } from '../services/OfflineService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function NotificationTestScreen() {
  const { pushToken, hasPermission, preferences } = useNotifications();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [testResults, setTestResults] = useState<Array<{type: string, success: boolean, message: string}>>([]);

  useEffect(() => {
    checkRealtimeStatus();
    loadSyncTimestamp();
    
    return () => {
      // Clean up any subscriptions if needed
    };
  }, []);

  const checkRealtimeStatus = async () => {
    try {
      const { data } = await supabase.from('shipments').select('id').limit(1);
      if (data) {
        setRealtimeStatus('connected');
      } else {
        setRealtimeStatus('disconnected');
      }
    } catch (error) {
      console.error('Error checking realtime status:', error);
      setRealtimeStatus('disconnected');
    }
  };

  const loadSyncTimestamp = async () => {
    const timestamps = await offlineService.getSyncTimestamps();
    if (timestamps.shipments) {
      setLastSyncTime(new Date(timestamps.shipments).toLocaleString());
    }
  };

  const testLocalNotification = async () => {
    setLoading(true);
    try {
      await notificationService.sendLocalNotification(
        'Test Notification',
        'This is a test notification from the test screen',
        { type: 'test' }
      );
      addTestResult('Local Notification', true, 'Successfully sent local notification');
    } catch (error) {
      console.error('Error sending local notification:', error);
      addTestResult('Local Notification', false, `Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testShipmentNotification = async () => {
    setLoading(true);
    try {
      await notificationService.sendLocalNotification(
        'Shipment Update',
        'Your shipment has been picked up by the driver',
        { 
          type: 'shipment_update',
          shipmentId: 'test-shipment-id',
          status: 'in_transit'
        }
      );
      addTestResult('Shipment Notification', true, 'Successfully sent shipment notification');
    } catch (error) {
      console.error('Error sending shipment notification:', error);
      addTestResult('Shipment Notification', false, `Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testMessageNotification = async () => {
    setLoading(true);
    try {
      await notificationService.sendLocalNotification(
        'New Message',
        'Driver: I am 10 minutes away from the pickup location',
        { 
          type: 'new_message',
          shipmentId: 'test-shipment-id',
          messageId: 'test-message-id'
        }
      );
      addTestResult('Message Notification', true, 'Successfully sent message notification');
    } catch (error) {
      console.error('Error sending message notification:', error);
      addTestResult('Message Notification', false, `Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testOfflineSync = async () => {
    setLoading(true);
    try {
      if (!user) {
        addTestResult('Offline Sync', false, 'User not logged in');
        return;
      }
      
      // Sync shipments for the current user
      const shipments = await offlineService.syncShipments(user.id);
      addTestResult('Offline Sync', true, `Successfully synced ${shipments.length} shipments`);
      
      // Update last sync time
      await loadSyncTimestamp();
    } catch (error) {
      console.error('Error testing offline sync:', error);
      addTestResult('Offline Sync', false, `Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const addTestResult = (type: string, success: boolean, message: string) => {
    setTestResults(prev => [
      { type, success, message, timestamp: new Date().toISOString() },
      ...prev.slice(0, 9) // Keep only the last 10 results
    ]);
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text h4 style={styles.title}>Notification Test Center</Text>
        
        {/* Status Panel */}
        <Card containerStyle={styles.card}>
          <Card.Title>System Status</Card.Title>
          <Card.Divider />
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Push Permissions:</Text>
            <Text style={hasPermission ? styles.statusGood : styles.statusBad}>
              {hasPermission ? 'Granted' : 'Not Granted'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Push Token:</Text>
            <Text style={pushToken ? styles.statusGood : styles.statusBad}>
              {pushToken ? 'Available' : 'Not Available'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Supabase Connection:</Text>
            <Text style={realtimeStatus === 'connected' ? styles.statusGood : styles.statusBad}>
              {realtimeStatus}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last Sync:</Text>
            <Text style={lastSyncTime ? styles.statusGood : styles.statusNeutral}>
              {lastSyncTime || 'Never'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Push Enabled:</Text>
            <Text style={preferences.pushEnabled ? styles.statusGood : styles.statusBad}>
              {preferences.pushEnabled ? 'Yes' : 'No'}
            </Text>
          </View>
        </Card>
        
        {/* Test Actions */}
        <Card containerStyle={styles.card}>
          <Card.Title>Test Actions</Card.Title>
          <Card.Divider />
          
          <Button
            title="Test Local Notification"
            onPress={testLocalNotification}
            loading={loading}
            disabled={loading}
            buttonStyle={[styles.button, styles.buttonPrimary]}
            containerStyle={styles.buttonContainer}
          />
          
          <Button
            title="Test Shipment Update"
            onPress={testShipmentNotification}
            loading={loading}
            disabled={loading}
            buttonStyle={[styles.button, styles.buttonSecondary]}
            containerStyle={styles.buttonContainer}
          />
          
          <Button
            title="Test Message Notification"
            onPress={testMessageNotification}
            loading={loading}
            disabled={loading}
            buttonStyle={[styles.button, styles.buttonSecondary]}
            containerStyle={styles.buttonContainer}
          />
          
          <Button
            title="Test Offline Sync"
            onPress={testOfflineSync}
            loading={loading}
            disabled={loading}
            buttonStyle={[styles.button, styles.buttonTertiary]}
            containerStyle={styles.buttonContainer}
          />
        </Card>
        
        {/* Test Results */}
        <Card containerStyle={styles.card}>
          <View style={styles.resultsTitleContainer}>
            <Text style={styles.resultsTitle}>Test Results</Text>
            <TouchableOpacity onPress={clearTestResults}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>
          <Card.Divider />
          
          {testResults.length === 0 ? (
            <Text style={styles.noResults}>No test results yet</Text>
          ) : (
            testResults.map((result, index) => (
              <View key={index}>
                <View style={styles.resultRow}>
                  <View style={styles.resultTypeContainer}>
                    <View style={[
                      styles.resultIndicator, 
                      result.success ? styles.successIndicator : styles.errorIndicator
                    ]} />
                    <Text style={styles.resultType}>{result.type}</Text>
                  </View>
                  <Text style={result.success ? styles.successText : styles.errorText}>
                    {result.success ? 'Success' : 'Failed'}
                  </Text>
                </View>
                <Text style={styles.resultMessage}>{result.message}</Text>
                {index < testResults.length - 1 && <Divider style={styles.resultDivider} />}
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: '#555',
  },
  statusGood: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  statusBad: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  statusNeutral: {
    color: '#9E9E9E',
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginVertical: 8,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonPrimary: {
    backgroundColor: '#1E88E5',
  },
  buttonSecondary: {
    backgroundColor: '#4CAF50',
  },
  buttonTertiary: {
    backgroundColor: '#FF9800',
  },
  resultsTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    color: '#1E88E5',
    fontSize: 16,
  },
  noResults: {
    textAlign: 'center',
    color: '#9E9E9E',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  resultTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  successIndicator: {
    backgroundColor: '#4CAF50',
  },
  errorIndicator: {
    backgroundColor: '#F44336',
  },
  resultType: {
    fontSize: 16,
    fontWeight: '500',
  },
  successText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  resultMessage: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
    marginLeft: 18,
  },
  resultDivider: {
    marginVertical: 8,
  },
});
