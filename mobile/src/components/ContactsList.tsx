import React from 'react';
import { FlatList, View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Contact } from '../types/MessageTypes';
import { Colors } from '../constants/DesignSystem';
import { formatDistanceToNow } from 'date-fns';

interface ContactsListProps {
  contacts: Contact[];
  selectedContactId?: string | null;
  onSelectContact: (contact: Contact) => void;
  emptyMessage: string;
  emptySubMessage: string;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * A dedicated component for rendering the contacts list
 */
export const ContactsList = ({
  contacts,
  selectedContactId,
  onSelectContact,
  emptyMessage,
  emptySubMessage,
  refreshing,
  onRefresh
}: ContactsListProps) => {
  // Check if a contact is allowed to be messaged
  const canMessageContact = (contact: Contact) => {
    // Admins can always be messaged
    if (contact.isAdmin || contact.role === 'admin') return true;
    
    // For drivers/clients, check the shipment status
    if (contact.shipmentStatus === 'delivered') {
      // Check if delivered within 24h
      if (contact.lastMessageTime) {
        const deliveredTime = new Date(contact.lastMessageTime).getTime();
        const now = new Date().getTime();
        return (now - deliveredTime <= 24 * 60 * 60 * 1000);
      }
      return false;
    }
    
    // All other active statuses are allowed
    return ['accepted', 'in_transit'].includes(contact.shipmentStatus || '');
  };

  // Format relative time for contact list
  const formatRelativeTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  // Render a contact item
  const renderContactItem = ({ item }: { item: Contact }) => {
    const isSelected = selectedContactId === item.id;
    const canMessage = canMessageContact(item);
    
    return (
      <TouchableOpacity
        style={[
          styles.contactItem,
          isSelected && styles.selectedContactItem,
          !canMessage && styles.expiredContactItem,
        ]}
        onPress={() => onSelectContact(item)}
        disabled={!canMessage}
      >
        <View style={[styles.contactAvatar, item.isAdmin && styles.adminAvatar]}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.contactInitial}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.lastMessage, !canMessage && styles.expiredMessage]} numberOfLines={1}>
            {!canMessage ? 'Conversation expired' : (item.lastMessage || 'No messages yet')}
          </Text>
        </View>
        
        <View style={styles.contactMeta}>
          {item.lastMessageTime && (
            <Text style={styles.contactMessageTime}>
              {formatRelativeTime(item.lastMessageTime)}
            </Text>
          )}
          
          {item.unreadCount ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyContactsList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="forum" size={64} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>{emptyMessage}</Text>
      <Text style={styles.emptyMessage}>{emptySubMessage}</Text>
    </View>
  );

  return (
    <FlatList
      data={contacts}
      renderItem={renderContactItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.contactsList}
      ListEmptyComponent={renderEmptyContactsList}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
};

const styles = StyleSheet.create({
  contactsList: {
    flexGrow: 1,
  },
  contactItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  selectedContactItem: {
    backgroundColor: Colors.primary + '10', // 10% opacity
  },
  expiredContactItem: {
    opacity: 0.5,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminAvatar: {
    backgroundColor: Colors.error,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  contactInitial: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  expiredMessage: {
    fontStyle: 'italic',
  },
  contactMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  contactMessageTime: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
