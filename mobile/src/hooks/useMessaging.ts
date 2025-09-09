/**
 * React Hook for Real-time Messaging
 * 
 * This hook provides a clean interface for messaging functionality including:
 * - Real-time message updates
 * - Message sending with validation
 * - Read status management
 * - Connection state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Message, 
  Conversation, 
  SendMessageRequest, 
  MessagingStatus 
} from '../types/MessageTypes';
import MessagingService from '../services/MessagingService';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseMessagingOptions {
  shipmentId?: string;
  autoConnect?: boolean;
  loadInitialMessages?: boolean;
}

export interface UseMessagingReturn {
  // State
  messages: Message[];
  conversations: Conversation[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  connected: boolean;
  messagingStatus: MessagingStatus | null;

  // Actions
  sendMessage: (content: string, receiverId?: string, messageType?: 'text' | 'system' | 'notification') => Promise<boolean>;
  markAsRead: (messageId: string) => Promise<boolean>;
  loadMoreMessages: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  connect: () => void;
  disconnect: () => void;
  clearError: () => void;
}

export function useMessaging(options: UseMessagingOptions = {}): UseMessagingReturn {
  const { shipmentId, autoConnect = true, loadInitialMessages: shouldLoadInitialMessages = true } = options;
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [messagingStatus, setMessagingStatus] = useState<MessagingStatus | null>(null);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const conversationsChannelRef = useRef<RealtimeChannel | null>(null);
  const messagesOffsetRef = useRef(0);
  const hasMoreMessagesRef = useRef(true);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check messaging status
  const checkMessagingStatus = useCallback(async () => {
    if (!shipmentId) return;
    
    try {
      const status = await MessagingService.checkMessagingStatus(shipmentId);
      setMessagingStatus(status);
    } catch (err) {
      console.error('Error checking messaging status:', err);
    }
  }, [shipmentId]);

  // Load initial messages
  const loadMessagesData = useCallback(async () => {
    if (!shipmentId || !shouldLoadInitialMessages) return;

    setLoading(true);
    setError(null);

    try {
      const initialMessages = await MessagingService.getConversationMessages(shipmentId, 50, 0);
      setMessages(initialMessages);
      messagesOffsetRef.current = initialMessages.length;
      hasMoreMessagesRef.current = initialMessages.length === 50;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  }, [shipmentId, shouldLoadInitialMessages]);

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!shipmentId || !hasMoreMessagesRef.current || loading) return;

    setLoading(true);
    try {
      const moreMessages = await MessagingService.getConversationMessages(
        shipmentId, 
        50, 
        messagesOffsetRef.current
      );
      
      if (moreMessages.length > 0) {
        setMessages(prev => [...moreMessages, ...prev]);
        messagesOffsetRef.current += moreMessages.length;
        hasMoreMessagesRef.current = moreMessages.length === 50;
      } else {
        hasMoreMessagesRef.current = false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more messages';
      setError(errorMessage);
      console.error('Error loading more messages:', err);
    } finally {
      setLoading(false);
    }
  }, [shipmentId, loading]);

  // Load conversations
  const refreshConversations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userConversations = await MessagingService.getUserConversations();
      setConversations(userConversations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(errorMessage);
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (
    content: string, 
    receiverId?: string, 
    messageType: 'text' | 'system' | 'notification' = 'text'
  ): Promise<boolean> => {
    if (!shipmentId) {
      setError('No shipment ID provided');
      return false;
    }

    if (!content.trim()) {
      setError('Message cannot be empty');
      return false;
    }

    setSending(true);
    setError(null);

    try {
      const request: SendMessageRequest = {
        shipment_id: shipmentId,
        content: content.trim(),
        receiver_id: receiverId,
        message_type: messageType
      };

      const response = await MessagingService.sendMessage(request);
      
      if (response.success && response.message) {
        // Message will be added via real-time subscription
        return true;
      } else {
        setError(response.error || 'Failed to send message');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      console.error('Error sending message:', err);
      return false;
    } finally {
      setSending(false);
    }
  }, [shipmentId]);

  // Mark message as read
  const markAsRead = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      const success = await MessagingService.markMessageAsRead(messageId);
      if (success) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, is_read: true, read_at: new Date().toISOString() }
              : msg
          )
        );
      }
      return success;
    } catch (err) {
      console.error('Error marking message as read:', err);
      return false;
    }
  }, []);

  // Connect to real-time updates
  const connect = useCallback(() => {
    if (connected) return;

    try {
      // Subscribe to conversation updates if shipmentId is provided
      if (shipmentId) {
        channelRef.current = MessagingService.subscribeToConversation(
          shipmentId,
          (newMessage: Message) => {
            setMessages(prev => {
              // Avoid duplicates
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              
              // Insert in chronological order
              const newMessages = [...prev, newMessage].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return newMessages;
            });
          },
          (updatedMessage: Message) => {
            setMessages(prev =>
              prev.map(msg => 
                msg.id === updatedMessage.id ? updatedMessage : msg
              )
            );
          },
          (error) => {
            console.error('Real-time error:', error);
            setError('Real-time connection error');
          }
        );
      }

      // Subscribe to all conversations updates
      conversationsChannelRef.current = MessagingService.subscribeToAllConversations(
        (updatedConversation: Conversation) => {
          setConversations(prev => {
            const index = prev.findIndex(conv => conv.shipment_id === updatedConversation.shipment_id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = updatedConversation;
              return updated.sort((a, b) => 
                new Date(b.last_message.created_at).getTime() - 
                new Date(a.last_message.created_at).getTime()
              );
            } else {
              return [updatedConversation, ...prev];
            }
          });
        },
        (error) => {
          console.error('Conversations real-time error:', error);
        }
      );

      setConnected(true);
    } catch (err) {
      console.error('Error connecting to real-time:', err);
      setError('Failed to connect to real-time updates');
    }
  }, [shipmentId, connected]);

  // Disconnect from real-time updates
  const disconnect = useCallback(() => {
    if (shipmentId && channelRef.current) {
      MessagingService.unsubscribeFromConversation(shipmentId);
      channelRef.current = null;
    }

    if (conversationsChannelRef.current) {
      MessagingService.unsubscribeFromAllConversations();
      conversationsChannelRef.current = null;
    }

    setConnected(false);
  }, [shipmentId]);

  // Effect for initialization
  useEffect(() => {
    const initialize = async () => {
      await checkMessagingStatus();
      await loadMessagesData();
      await refreshConversations();
      
      if (autoConnect) {
        connect();
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [shipmentId]); // Only depend on shipmentId to avoid infinite loops

  // Effect for auto-connection
  useEffect(() => {
    if (autoConnect && !connected) {
      connect();
    }
  }, [autoConnect, connected, connect]);

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
  };
}

export default useMessaging;
