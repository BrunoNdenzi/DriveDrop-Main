/**
 * ConversationPicker - Component for selecting conversations or starting new ones
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../hooks/useAuth';
import MessagingService from '../services/MessagingService';
import { UserProfile } from '../types/MessageTypes';

interface ConversationPickerProps {
  onSelectRecipient: (recipient: UserProfile, shipmentId?: string) => void;
  selectedShipmentId?: string;
}

export default function ConversationPicker({ onSelectRecipient, selectedShipmentId }: ConversationPickerProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<{
    clients: UserProfile[];
    drivers: UserProfile[];
    admins: UserProfile[];
  }>({ clients: [], drivers: [], admins: [] });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const availableContacts = await MessagingService.getAvailableContacts();
      setContacts(availableContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = (contact: UserProfile) => {
    onSelectRecipient(contact, selectedShipmentId);
  };

  const renderContact = ({ item }: { item: UserProfile }) => (
    <TouchableOpacity style={styles.contactItem} onPress={() => handleSelectContact(item)}>
      <View style={styles.contactAvatar}>
        <Text style={styles.contactAvatarText}>
          {item.first_name.charAt(0)}{item.last_name.charAt(0)}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>
          {item.first_name} {item.last_name}
        </Text>
        <Text style={styles.contactRole}>
          {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  const renderSection = (title: string, data: UserProfile[]) => {
    if (data.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <FlatList
          data={data}
          renderItem={renderContact}
          keyExtractor={(item, index) => item?.id || `contact-${index}`}
          scrollEnabled={false}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  const totalContacts = contacts.clients.length + contacts.drivers.length + contacts.admins.length;

  if (totalContacts === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color="#9ca3af" />
        <Text style={styles.emptyTitle}>No Contacts Available</Text>
        <Text style={styles.emptyText}>
          {user?.role === 'driver' 
            ? 'You need active shipments to message clients'
            : 'No contacts available for messaging'
          }
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select a contact to start messaging</Text>
      
      {renderSection('Clients', contacts.clients)}
      {renderSection('Drivers', contacts.drivers)}
      {renderSection('Support Team', contacts.admins)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  contactRole: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
});
