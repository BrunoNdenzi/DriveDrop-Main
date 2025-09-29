/**
 * Debug component for testing messaging system connectivity
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { MessagingService } from '../../services/MessagingServiceV2';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../utils/environment';

export default function MessagingDebugScreen() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    testApiConnectivity();
  }, []);

  const testApiConnectivity = async () => {
    try {
      const url = getApiUrl();
      setApiUrl(url);
      
      console.log('🔍 Testing API connectivity to:', url);
      
      // Test basic API connectivity
      const response = await fetch(`${url}/health`);
      const data = await response.json();
      
      if (response.ok) {
        setApiStatus('success');
        console.log('✅ API connectivity test passed:', data);
      } else {
        setApiStatus('error');
        setError(`API returned error: ${response.status}`);
      }
    } catch (err: any) {
      setApiStatus('error');
      setError(`Network error: ${err.message}`);
      console.error('❌ API connectivity test failed:', err);
    }
  };

  const testConversationsEndpoint = async () => {
    try {
      console.log('🔍 Testing conversations endpoint...');
      const userConversations = await MessagingService.getUserConversations();
      setConversations(userConversations);
      Alert.alert('Success', `Found ${userConversations.length} conversations`);
    } catch (err: any) {
      Alert.alert('Error', `Conversations test failed: ${err.message}`);
      console.error('❌ Conversations test failed:', err);
    }
  };

  const testMessageSend = async () => {
    try {
      if (conversations.length === 0) {
        Alert.alert('Error', 'No conversations found. Cannot test message sending.');
        return;
      }

      const firstConversation = conversations[0];
      console.log('🔍 Testing message sending...');
      
      const response = await MessagingService.sendMessage({
        conversation_id: firstConversation.id,
        content: 'Test message from debug screen',
        message_type: 'text'
      });
      
      Alert.alert('Success', 'Test message sent successfully!');
    } catch (err: any) {
      Alert.alert('Error', `Message send test failed: ${err.message}`);
      console.error('❌ Message send test failed:', err);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Messaging System Debug</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Connectivity</Text>
        <Text style={styles.label}>API URL: {apiUrl}</Text>
        <Text style={styles.label}>
          Status: {apiStatus === 'checking' ? 'Checking...' : apiStatus === 'success' ? '✅ Connected' : '❌ Failed'}
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.button} onPress={testApiConnectivity}>
          <Text style={styles.buttonText}>Test API Connectivity</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Info</Text>
        <Text style={styles.label}>User ID: {user?.id || 'Not logged in'}</Text>
        <Text style={styles.label}>User Role: {user?.role || 'Unknown'}</Text>
        <Text style={styles.label}>User Email: {user?.email || 'Unknown'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conversations Test</Text>
        <Text style={styles.label}>Found: {conversations.length} conversations</Text>
        {conversations.map((conv, index) => (
          <View key={conv.id || index} style={styles.conversationItem}>
            <Text style={styles.conversationText}>
              {index + 1}. {conv.shipment?.title || 'Unknown shipment'} - {conv.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        ))}
        <TouchableOpacity style={styles.button} onPress={testConversationsEndpoint}>
          <Text style={styles.buttonText}>Test Conversations Endpoint</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Message Sending Test</Text>
        <TouchableOpacity 
          style={[styles.button, conversations.length === 0 && styles.buttonDisabled]} 
          onPress={testMessageSend}
          disabled={conversations.length === 0}
        >
          <Text style={styles.buttonText}>Test Message Sending</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Logs</Text>
        <Text style={styles.debugText}>
          Check the console for detailed logs. Open Developer Tools to see network requests and responses.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#666',
  },
  error: {
    fontSize: 14,
    color: '#e74c3c',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  conversationItem: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  conversationText: {
    fontSize: 12,
    color: '#495057',
  },
  debugText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
});