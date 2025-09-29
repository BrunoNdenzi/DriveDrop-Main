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

  const { user } = useAuth();

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
      
      console.log(`✅ Loaded ${initialMessages.length} messages`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      console.error('🚨 Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loadInitialMessages]);

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

    try {
      console.log('📤 Sending message:', { conversationId, content: content.substring(0, 50) + '...' });
      
      const response = await MessagingService.sendMessage({
        conversation_id: conversationId,
        content: content.trim(),
        message_type: messageType
      });

      if (response.success) {
        // Don't add message to state here - let real-time subscription handle it
        console.log('✅ Message sent successfully');
        return true;
      } else {
        setError('Failed to send message');
        return false;
      }
    } catch (err) {
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
        // Update local state
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, read_at: new Date().toISOString() }
              : msg
          )
        );
        console.log('✅ Message marked as read');
      }
      
      return success;
    } catch (err) {
      console.error('🚨 Error marking message as read:', err);
      return false;
    }
  }, []);

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
   * Debug authentication
   */
  const debugAuth = useCallback(async () => {
    try {
      console.log('🧪 Testing authentication...');
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('🔑 Session details:', {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        tokenLength: session?.access_token?.length,
        expires: session?.expires_at
      });

      if (session) {
        // Test a simple API call
        const testResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/messages-v2/conversations`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        console.log('🌐 Test API call result:', {
          status: testResponse.status,
          ok: testResponse.ok,
          statusText: testResponse.statusText
        });
        
        if (testResponse.ok) {
          const result = await testResponse.json();
          console.log('✅ API Response:', result);
        } else {
          const errorText = await testResponse.text();
          console.log('❌ API Error:', errorText);
        }
      }
    } catch (error) {
      console.error('🚨 Debug auth error:', error);
    }
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
    // Debug authentication on mount
    debugAuth();
    
    if (loadInitialMessages) {
      loadMessagesData();
    }
  }, [loadMessagesData, debugAuth]);

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
    getConversationByShipment,
    debugAuth
  };
}