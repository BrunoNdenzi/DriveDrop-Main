/**
 * MessagingScreen - Cimport useAuth from '../../hooks/useAuth';
import useMessaging from '../../hooks/useMessaging';
import { Message, Conversation } from '../../types/MessageTypes';n implementation for real-time messaging
 * 
 * Features:
 * - Real-time message delivery
 * - Role-based access control
 * - 24-hour expiry for completed shipments
 * - Admin can message anyone
 * - Drivers only message clients from assigned shipments
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../../hooks/useAuth';
import useMessaging from '../../hooks/useMessaging';
import { Message, Conversation } from '../../types/MessageTypes';
import { format, isToday, isYesterday } from 'date-fns';

interface MessagingScreenProps {
  route: {
    params: {
      shipmentId?: string;
      conversationMode?: 'single' | 'list';
      recipientId?: string;
      recipientName?: string;
    };
  };
  navigation: any;
}

export default function MessagingScreen({ route, navigation }: MessagingScreenProps) {
  console.log('🎬 MessagingScreen rendered with route params:', route.params);
  
  const { user } = useAuth();
  const { shipmentId, conversationMode = 'list', recipientId, recipientName } = route.params || {};
  
  console.log('👤 Current user:', user);
  console.log('📦 Shipment ID:', shipmentId);
  console.log('🔄 Conversation mode:', conversationMode);
  
  const [messageText, setMessageText] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(shipmentId || null);
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    conversations,
    loading,
    sending,
    error,
    connected,
    messagingStatus,
    sendMessage,
    markAsRead,
    loadMoreMessages,
    refreshConversations,
    clearError,
  } = useMessaging({
    shipmentId: selectedConversation || undefined,
    autoConnect: true,
    loadInitialMessages: true,
  });

  // Set navigation title and improved header
  useEffect(() => {
    if (conversationMode === 'single' && recipientName) {
      navigation.setOptions({
        title: recipientName,
        headerStyle: { 
          backgroundColor: '#1e40af',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
        headerRight: () => (
          <View style={styles.headerStatus}>
            <View style={[styles.connectionDot, { backgroundColor: connected ? '#10b981' : '#ef4444' }]} />
            <Text style={styles.connectionText}>
              {connected ? 'Online' : 'Connecting...'}
            </Text>
          </View>
        ),
      });
    } else {
      navigation.setOptions({
        title: 'Messages',
        headerStyle: { 
          backgroundColor: '#1e40af',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '700',
        },
      });
    }
  }, [navigation, conversationMode, recipientName, connected]);

  // Handle sending message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    if (!selectedConversation) {
      Alert.alert('Error', 'Please select a conversation first');
      return;
    }

    const success = await sendMessage(messageText, recipientId);
    if (success) {
      setMessageText('');
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Handle conversation selection
  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation.shipment_id);
    navigation.navigate('MessagingScreen', {
      shipmentId: conversation.shipment_id,
      conversationMode: 'single',
      recipientId: conversation.other_participant.id,
      recipientName: `${conversation.other_participant.first_name} ${conversation.other_participant.last_name}`,
    });
  };

  // Format message time
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM dd');
    }
  };

  // Render message item
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const showAvatar = !isOwnMessage;

    return (
      <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
        {showAvatar && (
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.sender.first_name.charAt(0)}{item.sender.last_name.charAt(0)}
              </Text>
            </View>
          </View>
        )}
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>
              {item.sender.first_name} {item.sender.last_name}
            </Text>
          )}
          <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime]}>
              {formatMessageTime(item.created_at)}
            </Text>
            {isOwnMessage && (
              <Ionicons 
                name={item.is_read ? "checkmark-done" : "checkmark"} 
                size={12} 
                color={item.is_read ? "#3b82f6" : "#9ca3af"} 
                style={styles.readStatus}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  // Render conversation item
  const renderConversation = ({ item }: { item: Conversation }) => {
    const participant = item.other_participant;
    const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
    
    return (
      <TouchableOpacity
        style={[styles.conversationItem, !item.messaging_allowed && styles.disabledConversation]}
        onPress={() => item.messaging_allowed ? handleConversationSelect(item) : null}
        disabled={!item.messaging_allowed}
      >
        <View style={styles.conversationAvatar}>
          <Text style={styles.conversationAvatarText}>
            {participant.first_name.charAt(0)}{participant.last_name.charAt(0)}
          </Text>
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName}>
              {participant.first_name} {participant.last_name}
            </Text>
            <View style={styles.conversationMeta}>
              {item.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{item.unread_count}</Text>
                </View>
              )}
              <Text style={styles.conversationTime}>
                {formatMessageTime(item.last_message.created_at)}
              </Text>
            </View>
          </View>
          <View style={styles.conversationFooter}>
            <Text style={styles.conversationPreview} numberOfLines={1}>
              {item.last_message.content}
            </Text>
            <View style={styles.conversationStatus}>
              <Text style={[styles.shipmentStatus, getStatusColor(item.shipment_status)]}>
                {item.shipment_status.replace('_', ' ').toUpperCase()}
              </Text>
              {!item.messaging_allowed && (
                <Text style={styles.expiredText}>
                  {isExpired ? 'Expired' : 'Unavailable'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return { color: '#10b981' };
      case 'in_transit': return { color: '#3b82f6' };
      case 'picked_up': return { color: '#f59e0b' };
      case 'accepted': return { color: '#8b5cf6' };
      default: return { color: '#6b7280' };
    }
  };

  // Show error alert
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: clearError }
      ]);
    }
  }, [error, clearError]);

  // Render messaging disabled state
  const renderMessagingDisabled = () => (
    <View style={styles.disabledContainer}>
      <Ionicons name="chatbubble-outline" size={64} color="#9ca3af" />
      <Text style={styles.disabledTitle}>Messaging Unavailable</Text>
      <Text style={styles.disabledText}>
        {messagingStatus?.expires_at 
          ? 'This conversation has expired (24 hours after delivery)'
          : 'Messaging is not available for this shipment'}
      </Text>
    </View>
  );

  // Render conversation view
  const renderConversationView = () => {
    if (!messagingStatus?.allowed) {
      return renderMessagingDisabled();
    }

    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadMoreMessages} />
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        
        {messagingStatus?.expires_at && (
          <View style={styles.expiryNotice}>
            <Ionicons name="time-outline" size={16} color="#f59e0b" />
            <Text style={styles.expiryText}>
              Conversation expires {formatMessageTime(messagingStatus.expires_at)}
            </Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  };

  // Render conversations list
  const renderConversationsList = () => (
    <View style={styles.container}>
      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No Conversations</Text>
          <Text style={styles.emptyText}>
            Your message conversations will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.shipment_id}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refreshConversations} />
          }
          style={styles.conversationsList}
        />
      )}
    </View>
  );

  if (loading && conversations.length === 0 && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Debug header to verify full screen and data */}
      <View style={{ backgroundColor: '#ff6b6b', padding: 8, zIndex: 1000 }}>
        <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
          🔧 DEBUG: Mode={conversationMode} | ShipmentID={selectedConversation || 'none'} | User={user?.role || 'none'}
        </Text>
      </View>
      
      {conversationMode === 'single' ? renderConversationView() : renderConversationsList()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    color: '#fff',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  // Messages styles
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  ownBubble: {
    backgroundColor: '#1e40af',
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#1f2937',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#9ca3af',
  },
  readStatus: {
    marginLeft: 4,
  },
  // Enhanced input styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 120,
    minHeight: 48,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#1e293b',
  },
  sendButton: {
    backgroundColor: '#1e40af',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  // Conversations list styles
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  disabledConversation: {
    opacity: 0.6,
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  conversationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  conversationTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationPreview: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
    marginRight: 8,
  },
  conversationStatus: {
    alignItems: 'flex-end',
  },
  shipmentStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  expiredText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '500',
  },
  // Empty states
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
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  disabledTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  disabledText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  // Expiry notice
  expiryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fef3c7',
    borderTopWidth: 1,
    borderTopColor: '#f59e0b',
  },
  expiryText: {
    fontSize: 12,
    color: '#92400e',
    marginLeft: 4,
  },
});
