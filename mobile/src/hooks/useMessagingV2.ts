/**
 * NEW MESSAGING HOOK V2 - Complete Re-implementation
 * Maintains design and functionality with improved architecture
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { MessagingService } from '../services/MessagingServiceV2';
import { 
  Message, 
  Conversation, 
  MessagingStatus,
  ConversationInfo,
  UseMessagingOptions,
  UseMessagingReturn,
  MessageEvent,
  ConversationEvent
} from '../types/MessagingTypes';
import { useAuth } from '../context/AuthContext';

export function useMessagingV2(options: UseMessagingOptions = {}): UseMessagingReturn {
  const { 
    conversationId, 
    autoConnect = true, 
    loadInitialMessages = true 
  } = options;

  const { user, userProfile } = useAuth();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [messagingStatus, setMessagingStatus] = useState<MessagingStatus | null>(null);

  // Refs for managing subscriptions and pagination
  const conversationChannelRef = useRef<RealtimeChannel | null>(null);
  const userChannelRef = useRef<RealtimeChannel | null>(null);
  const messagesOffsetRef = useRef(0);
  const hasMoreMessagesRef = useRef(true);

  /**
   * Load initial messages for a conversation
   */
  const loadMessagesData = useCallback(async () => {
    if (!conversationId || !loadInitialMessages) return;

    setLoading(true);
    setError(null);

    try {
      console.log('📥 Loading initial messages for conversation:', conversationId);
      const initialMessages = await MessagingService.getConversationMessages(conversationId, 50, 0);
      setMessages(initialMessages);
      messagesOffsetRef.current = initialMessages.length;
      hasMoreMessagesRef.current = initialMessages.length === 50;
      
      // Mark unread messages from other users as read
      const unreadMessages = initialMessages.filter(msg => 
        msg.sender_id !== userProfile?.id && 
        msg.sender_id !== user?.id && 
        !msg.read_at
      );
      
      if (unreadMessages.length > 0) {
        console.log(`📖 Marking ${unreadMessages.length} messages as read`);
        // Mark them as read asynchronously without waiting
        unreadMessages.forEach(msg => {
          MessagingService.markMessageAsRead(msg.id).then(success => {
            if (success) {
              // Update local state
              setMessages(prev => 
                prev.map(m => 
                  m.id === msg.id 
                    ? { ...m, read_at: new Date().toISOString() }
                    : m
                )
              );
            }
          });
        });
        
        // Update conversations list to reset unread count for this conversation
        setConversations(prev =>
          prev.map(conv => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                unread_count: Math.max(0, conv.unread_count - unreadMessages.length)
              };
            }
            return conv;
          })
        );
      }
      
      console.log(`✅ Loaded ${initialMessages.length} messages`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      console.error('🚨 Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loadInitialMessages, userProfile?.id, user?.id]);

  /**
   * Load more messages (pagination)
   */
  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || !hasMoreMessagesRef.current || loading) return;

    setLoading(true);
    try {
      console.log('📥 Loading more messages, offset:', messagesOffsetRef.current);
      const moreMessages = await MessagingService.getConversationMessages(
        conversationId, 
        50, 
        messagesOffsetRef.current
      );
      
      if (moreMessages.length > 0) {
        setMessages(prev => [...moreMessages, ...prev]);
        messagesOffsetRef.current += moreMessages.length;
        hasMoreMessagesRef.current = moreMessages.length === 50;
        console.log(`✅ Loaded ${moreMessages.length} more messages`);
      } else {
        hasMoreMessagesRef.current = false;
        console.log('📭 No more messages to load');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more messages';
      setError(errorMessage);
      console.error('🚨 Error loading more messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading]);

  /**
   * Refresh conversations list
   */
  const refreshConversations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Refreshing conversations');
      const userConversations = await MessagingService.getUserConversations();
      setConversations(userConversations);
      console.log(`✅ Refreshed ${userConversations.length} conversations`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(errorMessage);
      console.error('🚨 Error refreshing conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Send a message
   */
  const sendMessage = useCallback(async (
    content: string, 
    messageType: 'text' | 'system' | 'notification' = 'text'
  ): Promise<boolean> => {
    if (!conversationId) {
      setError('No conversation selected');
      return false;
    }

    if (!content.trim()) {
      setError('Message content cannot be empty');
      return false;
    }

    setSending(true);
    setError(null);

    // Create optimistic message for immediate UI update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`, // Temporary ID
      conversation_id: conversationId,
      sender_id: userProfile?.id || user?.id || '',
      content: content.trim(),
      message_type: messageType,
      sent_at: new Date().toISOString(),
      delivered_at: undefined, // Will be updated when response comes back
      read_at: undefined,
      created_at: new Date().toISOString(),
      sender: {
        id: userProfile?.id || user?.id || '',
        first_name: userProfile?.first_name || 'You',
        last_name: userProfile?.last_name || '',
        avatar_url: userProfile?.avatar_url,
        role: userProfile?.role || 'driver',
        email: userProfile?.email || user?.email || ''
      }
    };

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      console.log('📤 Sending message:', { conversationId, content: content.substring(0, 50) + '...' });
      
      const response = await MessagingService.sendMessage({
        conversation_id: conversationId,
        content: content.trim(),
        message_type: messageType
      });

      if (response.success && response.data) {
        // Replace optimistic message with real message
        setMessages(prev => 
          prev.map(msg => 
            msg.id === optimisticMessage.id ? response.data : msg
          )
        );

        // Update conversations list with the new last message and move to top
        setConversations(prev => {
          const updatedConversations = prev.map(conv => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                last_message: {
                  content: response.data.content,
                  created_at: response.data.created_at,
                  sender_id: response.data.sender_id
                },
                // Update conversation to show it was just updated
                updated_at: response.data.created_at
              };
            }
            return conv;
          });
          
          // Sort conversations to put the updated one at the top
          return updatedConversations.sort((a, b) => {
            const aTime = a.last_message?.created_at || a.created_at;
            const bTime = b.last_message?.created_at || b.created_at;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          });
        });

        console.log('✅ Message sent successfully');
        return true;
      } else {
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        setError('Failed to send message');
        return false;
      }
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      console.error('🚨 Error sending message:', err);
      return false;
    } finally {
      setSending(false);
    }
  }, [conversationId]);

  /**
   * Mark a message as read
   */
  const markAsRead = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      console.log('👁️ Marking message as read:', messageId);
      const success = await MessagingService.markMessageAsRead(messageId);
      
      if (success) {
        // Update local messages state
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, read_at: new Date().toISOString() }
              : msg
          )
        );

        // Update conversations list to reduce unread count
        setConversations(prev =>
          prev.map(conv => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                unread_count: Math.max(0, conv.unread_count - 1)
              };
            }
            return conv;
          })
        );
        
        console.log('✅ Message marked as read');
      }
      
      return success;
    } catch (err) {
      console.error('🚨 Error marking message as read:', err);
      return false;
    }
  }, [conversationId]);

  /**
   * Get conversation by shipment ID
   */
  const getConversationByShipment = useCallback(async (shipmentId: string): Promise<ConversationInfo | null> => {
    try {
      console.log('🚢 Getting conversation for shipment:', shipmentId);
      const conversationInfo = await MessagingService.getConversationByShipment(shipmentId);
      console.log('✅ Conversation info retrieved:', conversationInfo);
      return conversationInfo;
    } catch (err) {
      console.error('🚨 Error getting conversation by shipment:', err);
      return null;
    }
  }, []);

  /**
   * Connect to real-time updates
   */
  const connect = useCallback(() => {
    if (connected || !user) return;

    console.log('🔌 Connecting to real-time messaging...');

    try {
      // Subscribe to specific conversation if provided
      if (conversationId) {
        conversationChannelRef.current = MessagingService.subscribeToConversation(
          conversationId,
          (newMessage: Message) => {
            console.log('📨 New message received via real-time:', newMessage.id);
            setMessages(prev => {
              // Avoid duplicates
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              
              // Insert in chronological order
              const newMessages = [...prev, newMessage].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return newMessages;
            });
          },
          (updatedMessage: Message) => {
            console.log('📝 Message updated via real-time:', updatedMessage.id);
            setMessages(prev => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
          },
          (error) => {
            console.error('🚨 Real-time conversation error:', error);
            setError('Real-time connection error');
          }
        );
      }

      // Subscribe to user's conversations
      userChannelRef.current = MessagingService.subscribeToUserConversations(
        user.id,
        (event: ConversationEvent) => {
          console.log('🔄 Conversation event received:', event.type);
          
          switch (event.type) {
            case 'CONVERSATION_CREATED':
              setConversations(prev => {
                const exists = prev.some(conv => conv.id === event.conversation.id);
                return exists ? prev : [event.conversation, ...prev];
              });
              break;
              
            case 'CONVERSATION_EXPIRED':
              setConversations(prev => 
                prev.map(conv => 
                  conv.id === event.conversation.id 
                    ? { ...conv, is_active: false, expires_at: event.conversation.expires_at }
                    : conv
                )
              );
              break;
              
            case 'CONVERSATION_REACTIVATED':
              setConversations(prev => 
                prev.map(conv => 
                  conv.id === event.conversation.id 
                    ? { ...conv, is_active: true, expires_at: undefined }
                    : conv
                )
              );
              break;
          }
        },
        (error) => {
          console.error('🚨 Real-time user conversations error:', error);
          setError('Real-time connection error');
        }
      );

      setConnected(true);
      console.log('✅ Connected to real-time messaging');
    } catch (err) {
      console.error('🚨 Error connecting to real-time messaging:', err);
      setError('Failed to connect to real-time updates');
    }
  }, [connected, user, conversationId]);

  /**
   * Disconnect from real-time updates
   */
  const disconnect = useCallback(() => {
    if (!connected) return;

    console.log('🔌 Disconnecting from real-time messaging...');

    if (conversationChannelRef.current) {
      MessagingService.unsubscribeFromConversation(conversationId || '');
      conversationChannelRef.current = null;
    }

    if (userChannelRef.current && user) {
      MessagingService.unsubscribeFromUserConversations(user.id);
      userChannelRef.current = null;
    }

    setConnected(false);
    console.log('✅ Disconnected from real-time messaging');
  }, [connected, conversationId, user]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Load messaging status for current conversation
   */
  const loadMessagingStatus = useCallback(async () => {
    if (!conversationId) return;

    try {
      console.log('📊 Loading messaging status for conversation:', conversationId);
      const status = await MessagingService.getMessagingStatus(conversationId);
      setMessagingStatus(status);
      console.log('✅ Messaging status loaded:', status);
    } catch (err) {
      console.error('🚨 Error loading messaging status:', err);
    }
  }, [conversationId]);

  // Effects
  useEffect(() => {
    if (loadInitialMessages) {
      loadMessagesData();
    }
  }, [loadMessagesData]);

  useEffect(() => {
    loadMessagingStatus();
  }, [loadMessagingStatus]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Initial load of conversations
  useEffect(() => {
    if (user && !conversationId) {
      refreshConversations();
    }
  }, [user, conversationId, refreshConversations]);

  return {
    // State
    messages,
    conversations,
    loading,
    sending,
    error,
    connected,
    messagingStatus,

    // Actions
    sendMessage,
    markAsRead,
    loadMoreMessages,
    refreshConversations,
    connect,
    disconnect,
    clearError,
    getConversationByShipment
  };
}