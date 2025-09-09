import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { MessageUtil } from '../../utils/MessageUtil';

// Define types
interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  shipmentId?: string; // Add shipmentId to track which shipment this contact is associated with
  shipmentStatus?: string; // Add shipment status to enforce business rules
  isAdmin?: boolean; // Flag to identify admin contacts
  role?: string; // User role (client, driver, admin)
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  shipment_id: string;
}

interface MessageGroup {
  date: string;
  messages: Message[];
}

export default function MessagesScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  
  // If contactId is provided in route params, we'll open that conversation directly
  const initialContactId = route.params?.contactId;
  const initialShipmentId = route.params?.shipmentId;
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageGroups, setMessageGroups] = useState<MessageGroup[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isContactsVisible, setIsContactsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { userProfile } = useAuth();
  
  const messageListRef = useRef<FlatList>(null);
  const messageSubscriptionRef = useRef<any>(null);
  const contactSubscriptionRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  // Refresh data when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userProfile) {
        fetchContacts();
      }
    });

    return unsubscribe;
  }, [navigation, userProfile]);

  // Initial setup and cleanup
  useEffect(() => {
    if (userProfile) {
      fetchContacts();
      setupContactsSubscription();
    }
    
    return () => {
      // Clean up subscriptions on unmount
      if (messageSubscriptionRef.current) {
        supabase.removeChannel(messageSubscriptionRef.current);
      }
      
      if (contactSubscriptionRef.current) {
        supabase.removeChannel(contactSubscriptionRef.current);
      }
    };
  }, [userProfile]);

  // Handle initial contact selection if provided
  useEffect(() => {
    if (initialContactId && contacts.length > 0) {
      const contact = contacts.find(c => c.id === initialContactId);
      if (contact) {
        handleSelectContact(contact);
      }
    }
  }, [initialContactId, contacts]);

  // Group messages by date for better UI organization
  useEffect(() => {
    if (messages.length > 0) {
      const groups: { [key: string]: Message[] } = {};
      
      messages.forEach(message => {
        const date = new Date(message.created_at).toLocaleDateString();
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(message);
      });
      
      const groupArray = Object.keys(groups).map(date => ({
        date,
        messages: groups[date],
      }));
      
      setMessageGroups(groupArray);
    } else {
      setMessageGroups([]);
    }
  }, [messages]);

  // Setup realtime subscriptions for new contacts
  const setupContactsSubscription = () => {
    if (!userProfile) return;
    
    // Set up real-time subscription for new messages that might create new contacts
    contactSubscriptionRef.current = supabase
      .channel('new-contacts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userProfile.id}`,
        },
        () => {
          // When a new message comes in, refresh contacts
          fetchContacts();
        }
      )
      .subscribe();
  };

  // Fetch all contacts (clients from shipments driver is assigned to and admin)
  const fetchContacts = async (isRefreshing = false) => {
    if (!userProfile) return;
    
    if (!isRefreshing) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      // For drivers, contacts would primarily be clients they've worked with
      // and potentially admin support staff
      const { data: shipments, error: shipmentsError } = await supabase
        .from('shipments')
        .select(`
          id,
          status,
          client_id,
          profiles:client_id(id, first_name, last_name, avatar_url, role),
          updated_at
        `)
        .eq('driver_id', userProfile.id);

      if (shipmentsError) throw shipmentsError;

      // Extract unique clients from shipments
      const uniqueClients: Record<string, Contact> = {};
      
      // Filter clients based on shipment status - only active or recently delivered shipments
      shipments.forEach((shipment: any) => {
        const profile = shipment.profiles as any;
        if (profile && !uniqueClients[profile.id]) {
          // Only allow messaging for shipments that are accepted, in_transit, or delivered within last 24h
          const isDelivered = (shipment as any).status === 'delivered';
          const deliveredWithin24h = isDelivered ? 
            (new Date().getTime() - new Date((shipment as any).updated_at).getTime() < 24 * 60 * 60 * 1000) : 
            true;
            
          // Check business rules: not pending, and if delivered, within 24h
          if (['accepted', 'in_transit'].includes((shipment as any).status) || (isDelivered && deliveredWithin24h)) {
            uniqueClients[profile.id] = {
              id: (shipment as any).id,
              name: `${(profile as any).first_name} ${(profile as any).last_name}`,
              avatar: (profile as any).avatar_url,
              shipmentId: (shipment as any).id,
              shipmentStatus: (shipment as any).status,
              role: 'client'
            };
          }
        }
      });
      
      // Also fetch admin contacts (for support)
      const { data: adminUsers, error: adminError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, role')
        .eq('role', 'admin');
        
      if (adminError) throw adminError;
      
      // Add admin users to contacts
      adminUsers?.forEach((admin: any) => {
        uniqueClients[(admin as any).id] = {
          id: (admin as any).id,
          name: `${(admin as any).first_name} ${(admin as any).last_name} (Support)`,
          avatar: (admin as any).avatar_url,
          isAdmin: true,
          role: 'admin'
        };
      });
      
      // Get last messages and unread counts for each contact
      const contactsArray = Object.values(uniqueClients);
      await Promise.all(
        contactsArray.map(async (contact) => {
          try {
            // Get last message for this contact
            const { data: lastMessage } = await supabase
              .from('messages')
              .select('*')
              .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${userProfile.id})`)
              .order('created_at', { ascending: false })
              .limit(1);
            
            // Get unread count for this contact
            const { data: unreadCountData } = await supabase
              .rpc('count_unread_messages', {
                p_user_id: userProfile.id, 
                p_contact_id: contact.id
              } as any);
            
            const unreadCount = unreadCountData || 0;
            
            if (lastMessage && lastMessage.length > 0) {
              contact.lastMessage = (lastMessage[0] as any).content;
              contact.lastMessageTime = (lastMessage[0] as any).created_at;
              contact.unreadCount = unreadCount;
              
              // If there's a shipment_id in the message but not in the contact, add it
              if ((lastMessage[0] as any).shipment_id && !contact.shipmentId) {
                contact.shipmentId = (lastMessage[0] as any).shipment_id;
              }
            }
          } catch (error) {
            console.error('Error fetching contact details:', error);
          }
        })
      );
      
      // Sort contacts by last message time (most recent first)
      contactsArray.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      // Update state with the enhanced contacts information
      setContacts(contactsArray);
      
      // If a shipment ID was provided but no contact, find the contact for that shipment
      if (initialShipmentId && !initialContactId && contactsArray.length > 0) {
        const contactForShipment = contactsArray.find(c => c.shipmentId === initialShipmentId);
        if (contactForShipment) {
          handleSelectContact(contactForShipment);
        }
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to load your contacts. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch messages between current user and selected contact
  const fetchMessages = async (contactId: string, shipmentId?: string) => {
    if (!userProfile) return;
    
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userProfile.id})`)
        .order('created_at', { ascending: true });
      
      // If shipment ID is provided, filter by that shipment
      if (shipmentId) {
        query = query.eq('shipment_id', shipmentId);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      
      setMessages(data || []);
      
      // Mark unread messages as read
      if (data) {
        const unreadMessages = data.filter(
          (msg: any) => (msg as any).sender_id === contactId && !(msg as any).is_read
        );
        
        for (const msg of unreadMessages) {
          await MessageUtil.markAsRead((msg as any).id, userProfile.id);
        }
      }
      
      // Set up real-time subscription for new messages
      if (messageSubscriptionRef.current) {
        supabase.removeChannel(messageSubscriptionRef.current);
      }
      
      // Create a new real-time channel for messages between these users
      messageSubscriptionRef.current = supabase
        .channel(`messages-${userProfile.id}-${contactId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `or(and(sender_id.eq.${userProfile.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userProfile.id}))`,
          },
          (payload) => {
            // Add new message to the list
            setMessages((prev) => [...prev, payload.new as Message]);
            
            // Mark message as read if it's from the contact
            if (payload.new.sender_id === contactId && payload.new.receiver_id === userProfile.id) {
              MessageUtil.markAsRead(payload.new.id, userProfile.id);
            }
            
            // Scroll to bottom
            setTimeout(() => {
              messageListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        )
        .subscribe();
      
      // Scroll to bottom of message list
      setTimeout(() => {
        messageListRef.current?.scrollToEnd({ animated: false });
      }, 100);
      
      // Update contacts to show this conversation has been read
      if (selectedContact) {
        setContacts(prevContacts => {
          return prevContacts.map(contact => {
            if (contact.id === selectedContact.id) {
              return {
                ...contact,
                unreadCount: 0
              };
            }
            return contact;
          });
        });
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages. Please try again.');
    }
  };

  // Handle contact selection
  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    fetchMessages(contact.id, contact.shipmentId);
    setIsContactsVisible(false);
    
    // Fade in animation for messages
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!userProfile || !selectedContact || !newMessage.trim()) return;
    
    // Check if the selected contact is still valid for messaging based on business rules
    if (!selectedContact.isAdmin && selectedContact.shipmentStatus === 'delivered') {
      // Check if the shipment was delivered more than 24 hours ago
      const shipmentData = contacts.find(c => c.id === selectedContact.id);
      if (!shipmentData || !shipmentData.lastMessageTime) {
        Alert.alert(
          'Cannot Send Message',
          'This conversation is no longer active because the shipment has been delivered.'
        );
        return;
      }
      
      const deliveredTime = new Date(shipmentData.lastMessageTime).getTime();
      const now = new Date().getTime();
      
      if (now - deliveredTime > 24 * 60 * 60 * 1000) {
        Alert.alert(
          'Conversation Expired',
          'This conversation has expired because the shipment was delivered more than 24 hours ago.'
        );
        return;
      }
    }
    
    try {
      setSendingMessage(true);
      
      // Use the MessageUtil to send the message
      const { success, error } = await MessageUtil.sendMessage(
        selectedContact.shipmentId || '', // Use the shipment ID if available
        userProfile.id,
        newMessage.trim(),
        selectedContact.id
      );
      
      if (!success) {
        throw new Error(error || 'Failed to send message');
      }
      
      // Clear the input
      setNewMessage('');
      
      // Update the contact's last message in the contacts list
      setContacts(prevContacts => {
        return prevContacts.map(contact => {
          if (contact.id === selectedContact.id) {
            return {
              ...contact,
              lastMessage: newMessage.trim(),
              lastMessageTime: new Date().toISOString(),
            };
          }
          return contact;
        });
      });
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Format time display for messages
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Format relative time for contact list
  const formatRelativeTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };
  
  // Get filtered contacts based on search
  const getFilteredContacts = () => {
    if (!searchQuery.trim()) return contacts;
    
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.lastMessage && contact.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };
  
  // Check if a contact is allowed to be messaged
  const canMessageContact = (contact: Contact) => {
    // Admins can always be messaged
    if (contact.isAdmin || contact.role === 'admin') return true;
    
    // For clients, check the shipment status
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

  // Render a single message item
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isFromMe = item.sender_id === userProfile?.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isFromMe ? styles.myMessageContainer : styles.theirMessageContainer,
      ]}>
        <View style={[
          styles.messageBubble,
          isFromMe ? styles.myMessageBubble : styles.theirMessageBubble,
        ]}>
          <Text style={[
            styles.messageText,
            isFromMe ? styles.myMessageText : styles.theirMessageText,
          ]}>
            {item.content}
          </Text>
        </View>
        <Text style={[
          styles.messageTime,
          isFromMe ? styles.myMessageTime : styles.theirMessageTime,
        ]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  // Render a date separator for message groups
  const renderDateSeparator = (date: string) => (
    <View style={styles.dateSeparator}>
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{date}</Text>
      <View style={styles.dateLine} />
    </View>
  );

  // Render a contact item in the contacts list
  const renderContactItem = ({ item }: { item: Contact }) => {
    const isSelected = selectedContact?.id === item.id;
    const canMessage = canMessageContact(item);
    
    return (
      <TouchableOpacity
        style={[
          styles.contactItem,
          isSelected && styles.selectedContactItem,
          !canMessage && styles.expiredContactItem,
        ]}
        onPress={() => handleSelectContact(item)}
        disabled={!canMessage}
      >
        <View style={[
          styles.contactAvatar, 
          item.role === 'admin' && styles.adminAvatar,
          item.role === 'client' && styles.clientAvatar
        ]}>
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
            <Text style={styles.messageTime}>
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

  // Render empty states
  const renderEmptyContactsList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="forum" size={64} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>No Conversations Yet</Text>
      <Text style={styles.emptyMessage}>
        {userProfile?.role === 'driver' 
          ? "You'll see your message contacts here after you're assigned to jobs."
          : "Conversations will appear here when you have active shipments with assigned drivers."}
      </Text>
    </View>
  );

  const renderEmptyMessagesList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="chat" size={64} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>No Messages Yet</Text>
      <Text style={styles.emptyMessage}>
        Start the conversation by sending a message below.
      </Text>
    </View>
  );

  // Render the contacts modal for mobile view
  const renderContactsModal = () => (
    <Modal
      visible={isContactsVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setIsContactsVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Conversations</Text>
          <TouchableOpacity onPress={() => setIsContactsVisible(false)}>
            <MaterialIcons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={Colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="cancel" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <FlatList
          data={getFilteredContacts()}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.contactsList}
          ListEmptyComponent={renderEmptyContactsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchContacts(true)}
              colors={[Colors.primary]}
            />
          }
        />
      </View>
    </Modal>
  );

  // Layout based on screen width
  const isTablet = screenWidth >= 768;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header for mobile */}
      {!isTablet && (
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Messages</Text>
        </LinearGradient>
      )}
      
      <View style={styles.content}>
        {/* Contacts column - always visible on tablet, hidden on mobile */}
        {isTablet ? (
          <View style={styles.contactsColumn}>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color={Colors.text.secondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search conversations..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="cancel" size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : (
              <FlatList
                data={getFilteredContacts()}
                renderItem={renderContactItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.contactsList}
                ListEmptyComponent={renderEmptyContactsList}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchContacts(true)}
                    colors={[Colors.primary]}
                  />
                }
              />
            )}
          </View>
        ) : (
          // Show contacts button on mobile
          <>
            {renderContactsModal()}
            {!selectedContact && (
              <View style={styles.mobileContactsView}>
                <View style={styles.mobilePrompt}>
                  <MaterialIcons name="chat" size={64} color={Colors.primary} />
                  <Text style={styles.mobilePromptTitle}>Your Conversations</Text>
                  <Text style={styles.mobilePromptText}>
                    View your conversations with clients and support staff
                  </Text>
                  <TouchableOpacity
                    style={styles.mobileContactsButton}
                    onPress={() => setIsContactsVisible(true)}
                  >
                    <Text style={styles.mobileContactsButtonText}>View Conversations</Text>
                  </TouchableOpacity>
                </View>
                
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                  </View>
                ) : contacts.length > 0 ? (
                  <View style={styles.recentContactsContainer}>
                    <Text style={styles.recentContactsTitle}>Recent Conversations</Text>
                    {contacts.slice(0, 3).map((contact, index) => 
                      <View key={contact.id || `contact-${index}`}>
                        {renderContactItem({ item: contact })}
                      </View>
                    )}
                    {contacts.length > 3 && (
                      <TouchableOpacity
                        style={styles.viewAllButton}
                        onPress={() => setIsContactsVisible(true)}
                      >
                        <Text style={styles.viewAllButtonText}>
                          View All ({contacts.length})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}

        {/* Messages Area */}
        <Animated.View style={[
          styles.messagesColumn, 
          { opacity: fadeAnim }
        ]}>
          {selectedContact ? (
            <KeyboardAvoidingView
              style={styles.messagesContent}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={100}
            >
              {/* Selected Contact Header */}
              <View style={styles.chatHeader}>
                {!isTablet && (
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                      setSelectedContact(null);
                      fadeAnim.setValue(0);
                    }}
                  >
                    <MaterialIcons name="arrow-back" size={24} color={Colors.text.primary} />
                  </TouchableOpacity>
                )}
                
                <View style={[
                  styles.chatContactAvatar, 
                  selectedContact.role === 'admin' && styles.adminAvatar,
                  selectedContact.role === 'client' && styles.clientAvatar
                ]}>
                  {selectedContact.avatar ? (
                    <Image source={{ uri: selectedContact.avatar }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.chatContactInitial}>
                      {selectedContact.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.chatContactInfo}>
                  <Text style={styles.chatContactName}>{selectedContact.name}</Text>
                  {selectedContact.shipmentId && !selectedContact.isAdmin && (
                    <Text style={styles.chatContactStatus}>
                      {selectedContact.shipmentStatus === 'accepted' ? 'Pickup Stage' : 
                       selectedContact.shipmentStatus === 'in_transit' ? 'In Transit' : 
                       selectedContact.shipmentStatus === 'delivered' ? 'Delivered' : 
                       'Shipment #' + selectedContact.shipmentId.substring(0, 8)}
                    </Text>
                  )}
                </View>
              </View>
              
              {/* Messages List - Grouped by Date */}
              <FlatList
                ref={messageListRef}
                style={styles.messagesList}
                data={messageGroups}
                renderItem={({ item: group }) => (
                  <View>
                    {renderDateSeparator(group.date)}
                    {group.messages.map((message: Message) => 
                      <View key={message.id}>
                        {renderMessageItem({ item: message })}
                      </View>
                    )}
                  </View>
                )}
                keyExtractor={(item) => item.date}
                contentContainerStyle={styles.messagesListContent}
                ListEmptyComponent={renderEmptyMessagesList}
              />
              
              {/* Message Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Type a message..."
                  value={newMessage}
                  onChangeText={setNewMessage}
                  multiline
                  maxLength={500}
                  placeholderTextColor={Colors.text.secondary}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!newMessage.trim() || sendingMessage) && styles.disabledSendButton,
                  ]}
                  onPress={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                >
                  {sendingMessage ? (
                    <ActivityIndicator size="small" color={Colors.text.inverse} />
                  ) : (
                    <MaterialIcons name="send" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : isTablet ? (
            <View style={styles.noSelectedContactContainer}>
              <MaterialIcons name="forum" size={80} color={Colors.text.disabled} />
              <Text style={styles.noSelectedContactText}>
                Select a conversation to start messaging
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  contactsColumn: {
    width: '35%',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  messagesColumn: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text.primary,
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
  clientAvatar: {
    backgroundColor: Colors.success,
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
  messageTime: {
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
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  messagesContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    marginRight: 12,
  },
  chatContactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatContactInfo: {
    flex: 1,
  },
  chatContactInitial: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: '600',
  },
  chatContactName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  chatContactStatus: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesListContent: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dateText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginHorizontal: 8,
    fontWeight: '500',
  },
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'column',
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 2,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary,
    borderTopRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  theirMessageText: {
    color: Colors.text.primary,
  },
  myMessageTime: {
    alignSelf: 'flex-end',
  },
  theirMessageTime: {
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 8,
    fontSize: 15,
    color: Colors.text.primary,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSendButton: {
    backgroundColor: Colors.text.disabled,
  },
  noSelectedContactContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  noSelectedContactText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  contactsList: {
    flexGrow: 1,
  },
  mobileContactsView: {
    flex: 1,
    padding: 20,
  },
  mobilePrompt: {
    alignItems: 'center',
    marginBottom: 32,
  },
  mobilePromptTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  mobilePromptText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  mobileContactsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  mobileContactsButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: '600',
  },
  recentContactsContainer: {
    marginTop: 12,
  },
  recentContactsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  viewAllButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  viewAllButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
