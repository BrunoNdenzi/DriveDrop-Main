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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { realtimeService } from '../../services/RealtimeService';

interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function MessagesScreen({ route, navigation }: any) {
  // If contactId is provided in route params, we'll open that conversation directly
  const initialContactId = route.params?.contactId;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const { userProfile } = useAuth();

  const messageListRef = useRef<FlatList>(null);
  const messageSubscriptionRef = useRef<any>(null);
  const contactSubscriptionRef = useRef<any>(null);

  useEffect(() => {
    fetchContacts();

    // Set up real-time subscription for new contacts/messages
    setupContactsSubscription();

    return () => {
      // Clean up subscriptions on unmount
      if (messageSubscriptionRef.current) {
        supabase.removeChannel(messageSubscriptionRef.current);
      }

      if (contactSubscriptionRef.current) {
        supabase.removeChannel(contactSubscriptionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialContactId && contacts.length > 0) {
      const contact = contacts.find(c => c.id === initialContactId);
      if (contact) {
        handleSelectContact(contact);
      }
    }
  }, [initialContactId, contacts]);

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

  const fetchContacts = async () => {
    if (!userProfile) return;

    setLoading(true);
    try {
      // For drivers, contacts would primarily be clients they've worked with
      // This would typically come from shipments they've been assigned to
      const { data: shipments, error: shipmentsError } = await supabase
        .from('shipments')
        .select(
          `
          *,
          profiles:client_id(id, first_name, last_name, avatar_url)
        `
        )
        .eq('driver_id', userProfile.id);

      if (shipmentsError) throw shipmentsError;

      // Extract unique clients from shipments
      const uniqueClients: Record<string, Contact> = {};

      shipments.forEach(shipment => {
        if (shipment.profiles && !uniqueClients[shipment.profiles.id]) {
          uniqueClients[shipment.profiles.id] = {
            id: shipment.profiles.id,
            name: `${shipment.profiles.first_name} ${shipment.profiles.last_name}`,
            avatar: shipment.profiles.avatar_url,
          };
        }
      });

      // Also fetch any system contacts or support staff (could be added later)

      // Get last messages and unread counts for each contact in parallel for better performance
      const contactsArray = Object.values(uniqueClients);
      await Promise.all(
        contactsArray.map(async contact => {
          try {
            // Get last message for this contact
            const { data: lastMessage } = await supabase
              .from('messages')
              .select('*')
              .or(
                `and(sender_id.eq.${userProfile.id},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${userProfile.id})`
              )
              .order('created_at', { ascending: false })
              .limit(1);

            // Get unread count for this contact using our new function
            const { data: unreadCountData } = await supabase.rpc(
              'count_unread_messages',
              {
                p_user_id: userProfile.id,
                p_contact_id: contact.id,
              }
            );

            const unreadCount = unreadCountData || 0;

            if (lastMessage && lastMessage.length > 0) {
              contact.lastMessage = lastMessage[0].content;
              contact.lastMessageTime = lastMessage[0].created_at;
              contact.unreadCount = unreadCount;
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
        return (
          new Date(b.lastMessageTime).getTime() -
          new Date(a.lastMessageTime).getTime()
        );
      });

      // Update state with the enhanced contacts information
      setContacts(contactsArray);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to load your contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (contactId: string) => {
    if (!userProfile) return;

    try {
      // Fetch message history between current user and selected contact
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${userProfile.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userProfile.id})`
        )
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      // Mark unread messages as read using our new function
      if (data) {
        const unreadMessages = data.filter(
          msg => msg.sender_id === contactId && !msg.is_read
        );

        for (const msg of unreadMessages) {
          await supabase.rpc('mark_message_as_read', {
            p_message_id: msg.id,
            p_user_id: userProfile.id,
          });
        }
      }

      // Set up real-time subscription for new messages using our RealtimeService
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
          payload => {
            // Add new message to the list
            setMessages(prev => [...prev, payload.new as Message]);

            // Mark message as read if it's from the contact
            if (
              payload.new.sender_id === contactId &&
              payload.new.receiver_id === userProfile.id
            ) {
              supabase.rpc('mark_message_as_read', {
                p_message_id: payload.new.id,
                p_user_id: userProfile.id,
              });
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
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages. Please try again.');
    }
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    fetchMessages(contact.id);
  };

  const handleSendMessage = async () => {
    if (!userProfile || !selectedContact || !newMessage.trim()) return;

    try {
      setSendingMessage(true);

      // Create message data
      const messageData = {
        sender_id: userProfile.id,
        receiver_id: selectedContact.id,
        shipment_id: null, // Optional: can be linked to a specific shipment
        content: newMessage.trim(),
        is_read: false,
        created_at: new Date().toISOString(),
      };

      // Insert the new message
      const { error } = await supabase.from('messages').insert([messageData]);

      if (error) throw error;

      // Clear the input
      setNewMessage('');

      // Update the contact's last message in the contacts list
      setContacts(prevContacts => {
        return prevContacts.map(contact => {
          if (contact.id === selectedContact.id) {
            return {
              ...contact,
              lastMessage: messageData.content,
              lastMessageTime: messageData.created_at,
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString();
  };

  const renderContactItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={[
        styles.contactItem,
        selectedContact?.id === item.id && styles.selectedContactItem,
      ]}
      onPress={() => handleSelectContact(item)}
    >
      <View style={styles.contactAvatar}>
        <Text style={styles.contactInitial}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        {item.lastMessage && (
          <Text
            style={styles.lastMessage}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.lastMessage}
          </Text>
        )}
      </View>
      <View style={styles.contactMeta}>
        {item.lastMessageTime && (
          <Text style={styles.messageTime}>
            {formatDate(item.lastMessageTime) === 'Today'
              ? formatTime(item.lastMessageTime)
              : formatDate(item.lastMessageTime)}
          </Text>
        )}
        {(item.unreadCount || 0) > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isFromMe = item.sender_id === userProfile?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isFromMe ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isFromMe ? styles.myMessageBubble : styles.theirMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isFromMe ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.content}
          </Text>
        </View>
        <Text
          style={[
            styles.messageTime,
            isFromMe ? styles.myMessageTime : styles.theirMessageTime,
          ]}
        >
          {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  const renderEmptyContactsList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="forum" size={64} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>No Contacts Yet</Text>
      <Text style={styles.emptyMessage}>
        You'll see your message contacts here after you're assigned to jobs.
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <View style={styles.content}>
        {/* Contacts List */}
        <View style={styles.contactsColumn}>
          {loading ? (
            <ActivityIndicator
              style={styles.loader}
              size="large"
              color={Colors.primary}
            />
          ) : (
            <FlatList
              data={contacts}
              renderItem={renderContactItem}
              keyExtractor={item => item.id}
              ListEmptyComponent={renderEmptyContactsList}
            />
          )}
        </View>

        {/* Messages Area */}
        <View style={styles.messagesColumn}>
          {selectedContact ? (
            <KeyboardAvoidingView
              style={styles.messagesContent}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={100}
            >
              {/* Selected Contact Header */}
              <View style={styles.chatHeader}>
                <View style={styles.chatContactAvatar}>
                  <Text style={styles.chatContactInitial}>
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.chatContactName}>
                  {selectedContact.name}
                </Text>
              </View>

              {/* Messages List */}
              <FlatList
                ref={messageListRef}
                style={styles.messagesList}
                data={messages}
                renderItem={renderMessageItem}
                keyExtractor={item => item.id}
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
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!newMessage.trim() || sendingMessage) &&
                      styles.disabledSendButton,
                  ]}
                  onPress={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                >
                  {sendingMessage ? (
                    <ActivityIndicator
                      size="small"
                      color={Colors.text.inverse}
                    />
                  ) : (
                    <MaterialIcons
                      name="send"
                      size={20}
                      color={Colors.text.inverse}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : (
            <View style={styles.noSelectedContactContainer}>
              <MaterialIcons
                name="forum"
                size={80}
                color={Colors.text.disabled}
              />
              <Text style={styles.noSelectedContactText}>
                Select a contact to start messaging
              </Text>
            </View>
          )}
        </View>
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
    backgroundColor: Colors.secondary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 15,
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
    color: Colors.text.inverse,
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
  contactItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  selectedContactItem: {
    backgroundColor: Colors.primary + '10', // 10% opacity
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
  contactInitial: {
    color: Colors.text.inverse,
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
    color: Colors.text.inverse,
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
  chatContactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatContactInitial: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  chatContactName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  messagesList: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesListContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: Colors.text.inverse,
  },
  theirMessageText: {
    color: Colors.text.primary,
  },
  myMessageTime: {
    textAlign: 'right',
    marginRight: 8,
    marginTop: 4,
  },
  theirMessageTime: {
    marginLeft: 8,
    marginTop: 4,
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
    paddingVertical: 8,
    maxHeight: 100,
    marginRight: 8,
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
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
