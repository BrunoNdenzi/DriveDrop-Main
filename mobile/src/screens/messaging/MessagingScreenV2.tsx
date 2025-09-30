/**
 * NEW MESSAGING SCREEN V2 - Complete Re-implementation
 * Maintains design and functionality with improved architecture
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useMessagingV2 } from '../../hooks/useMessagingV2';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { Message, Conversation } from '../../types/MessagingTypes';

interface MessagingScreenV2Props {
  route: {
    params?: {
      conversationId?: string;
      shipmentId?: string;
      mode?: 'conversation' | 'list';
    };
  };
  navigation: any;
}

export default function MessagingScreenV2({ route, navigation }: MessagingScreenV2Props) {
  const { user } = useAuth();
  const { conversationId, shipmentId, mode = 'list' } = route.params || {};
  
  // State
  const [messageText, setMessageText] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(conversationId || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Messaging hook
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
    getConversationByShipment
  } = useMessagingV2({
    conversationId: selectedConversationId || undefined,
    autoConnect: true,
    loadInitialMessages: true
  });

  // Effects
  useEffect(() => {
    // Set navigation header based on mode
    if (mode === 'conversation' && selectedConversationId) {
      const conversation = conversations.find(c => c.id === selectedConversationId);
      navigation.setOptions({
        title: conversation?.other_participant ? 
          `${conversation.other_participant.first_name} ${conversation.other_participant.last_name}` :
          'Conversation',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' }
      });
    } else {
      navigation.setOptions({
        title: 'Messages',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' }
      });
    }
  }, [navigation, mode, selectedConversationId, conversations]);

  useEffect(() => {
    // If shipmentId is provided, get the conversation for that shipment
    if (shipmentId && !conversationId) {
      getConversationByShipment(shipmentId).then(conversationInfo => {
        if (conversationInfo && conversationInfo.can_access) {
          setSelectedConversationId(conversationInfo.id);
        }
      });
    }
  }, [shipmentId, conversationId, getConversationByShipment]);

  useEffect(() => {
    // Clear error after showing it
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: clearError }
      ]);
    }
  }, [error, clearError]);

  // Handlers
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversationId) return;

    const messageToSend = messageText.trim();
    
    // Clear text field immediately (optimistic UI)
    setMessageText('');

    const success = await sendMessage(messageToSend);
    if (success) {
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Refresh conversations list to ensure it's up-to-date for when user goes back
      setTimeout(() => {
        console.log('🔄 Refreshing conversations after message sent');
        refreshConversations();
      }, 500);
    } else {
      // Restore text if sending failed
      setMessageText(messageToSend);
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    if (!conversation.is_active && (!conversation.expires_at || new Date(conversation.expires_at) < new Date())) {
      Alert.alert('Conversation Expired', 'This conversation has expired and is no longer available.');
      return;
    }

    setSelectedConversationId(conversation.id);
    
    // If we're in list mode, navigate to conversation mode
    if (mode === 'list') {
      navigation.push('MessagingV2', {
        conversationId: conversation.id,
        mode: 'conversation'
      });
    }
  };

  const handleMessagePress = async (message: Message) => {
    // Mark as read if it's not from current user and not already read
    if (message.sender_id !== user?.id && !message.read_at) {
      await markAsRead(message.id);
    }
  };

  const formatMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getMessageStatus = (message: Message): 'sent' | 'delivered' | 'read' => {
    if (message.read_at) return 'read';
    if (message.delivered_at) return 'delivered';
    return 'sent';
  };

  const renderMessageStatus = (message: Message, isOwnMessage: boolean) => {
    if (!isOwnMessage) return null;
    
    const status = getMessageStatus(message);
    
    // Always show at least one checkmark for own messages
    return (
      <View style={styles.messageStatusWrapper}>
        {status === 'sent' && (
          <Ionicons 
            name="checkmark" 
            size={14} 
            color={Colors.white} // White for better visibility on blue background
          />
        )}
        {status === 'delivered' && (
          <View style={styles.doubleCheckmark}>
            <Ionicons 
              name="checkmark" 
              size={14} 
              color={Colors.white} // White for better visibility
            />
            <Ionicons 
              name="checkmark" 
              size={14} 
              color={Colors.white} // White for better visibility
              style={{ marginLeft: -6 }}
            />
          </View>
        )}
        {status === 'read' && (
          <View style={styles.doubleCheckmark}>
            <Ionicons 
              name="checkmark" 
              size={14} 
              color={'#4CAF50'} // Green color for read status instead of blue
            />
            <Ionicons 
              name="checkmark" 
              size={14} 
              color={'#4CAF50'} // Green color for read status instead of blue
              style={{ marginLeft: -6 }}
            />
          </View>
        )}
      </View>
    );
  };

  // Render functions
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === user?.id;
    const status = getMessageStatus(item);
    
    return (
      <TouchableOpacity 
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage
        ]}
        onPress={() => handleMessagePress(item)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          item.message_type === 'system' && styles.systemMessageBubble
        ]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>
              {item.sender.first_name} {item.sender.last_name}
            </Text>
          )}
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            item.message_type === 'system' && styles.systemMessageText
          ]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
            ]}>
              {formatMessageTime(item.created_at)}
            </Text>
            {renderMessageStatus(item, isOwnMessage)}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isExpired = !item.is_active && (!item.expires_at || new Date(item.expires_at) < new Date());
    const participant = item.other_participant;
    
    if (!participant) return null;

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          isExpired && styles.expiredConversation
        ]}
        onPress={() => handleConversationSelect(item)}
        disabled={isExpired}
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
              {item.last_message && (
                <Text style={styles.conversationTime}>
                  {formatMessageTime(item.last_message.created_at)}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.conversationFooter}>
            {item.shipment && (
              <Text style={styles.shipmentTitle} numberOfLines={1}>
                📦 {item.shipment.title}
              </Text>
            )}
            {item.last_message && (
              <Text style={styles.conversationPreview} numberOfLines={1}>
                {item.last_message.content}
              </Text>
            )}
            {isExpired && (
              <Text style={styles.expiredText}>Conversation expired</Text>
            )}
          </View>
        </View>

        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={Colors.text.secondary} 
        />
      </TouchableOpacity>
    );
  };

  const renderConversationsList = () => (
    <View style={styles.container}>
      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={Colors.text.secondary} />
          <Text style={styles.emptyTitle}>No Conversations</Text>
          <Text style={styles.emptyText}>
            Your conversations will appear here when you have active shipments with assigned drivers.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={loading || isRefreshing} 
              onRefresh={() => {
                setIsRefreshing(true);
                refreshConversations().finally(() => setIsRefreshing(false));
              }} 
            />
          }
          style={styles.conversationsList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderMessagesView = () => (
    <View style={styles.container}>
      {!selectedConversationId ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={64} color={Colors.text.secondary} />
          <Text style={styles.emptyTitle}>Select a Conversation</Text>
          <Text style={styles.emptyText}>
            Choose a conversation to start messaging
          </Text>
        </View>
      ) : (
        <>
          {/* Connection Status */}
          {!connected && (
            <View style={styles.connectionStatus}>
              <Text style={styles.connectionText}>Connecting...</Text>
            </View>
          )}

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.1}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadMoreMessages} />
            }
          />

          {/* Message Input */}
          {messagingStatus?.can_access && messagingStatus?.is_active && (
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.inputContainer}
            >
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Type a message..."
                  placeholderTextColor={Colors.text.secondary}
                  multiline
                  maxLength={2000}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!messageText.trim() || sending) && styles.sendButtonDisabled
                  ]}
                  onPress={handleSendMessage}
                  disabled={!messageText.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Ionicons name="send" size={20} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* Conversation Status */}
          {messagingStatus && !messagingStatus.is_active && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                {messagingStatus.expires_at ? 
                  'This conversation has expired' : 
                  'This conversation is no longer active'
                }
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );

  if (loading && conversations.length === 0 && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return mode === 'conversation' ? renderMessagesView() : renderConversationsList();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.text.secondary,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  connectionStatus: {
    backgroundColor: Colors.warning,
    padding: 8,
    alignItems: 'center',
  },
  connectionText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  // Conversations List Styles
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  expiredConversation: {
    opacity: 0.6,
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationAvatarText: {
    color: Colors.white,
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
    color: Colors.text.primary,
  },
  conversationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  unreadCount: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  conversationTime: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  conversationFooter: {
    gap: 2,
  },
  shipmentTitle: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  conversationPreview: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  expiredText: {
    fontSize: 12,
    color: Colors.error,
    fontStyle: 'italic',
  },
  // Messages View Styles
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  systemMessageBubble: {
    backgroundColor: Colors.warning,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: Colors.white,
  },
  otherMessageText: {
    color: Colors.text.primary,
  },
  systemMessageText: {
    color: Colors.white,
    textAlign: 'center',
    fontWeight: '500',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: Colors.text.secondary,
  },
  messageStatus: {
    marginLeft: 4,
  },
  messageStatusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  doubleCheckmark: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8, // Overlap the icons slightly
  },
  // Input Styles
  inputContainer: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    color: Colors.text.primary,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.text.secondary,
    opacity: 0.5,
  },
  statusContainer: {
    backgroundColor: Colors.surface,
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statusText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
});