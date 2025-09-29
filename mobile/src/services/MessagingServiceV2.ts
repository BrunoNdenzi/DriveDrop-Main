/**
 * NEW MESSAGING SERVICE V2 - Complete Re-implementation
 * Maintains design and functionality with improved architecture
 */
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getApiUrl } from '../utils/environment';
import { 
  Message, 
  Conversation, 
  SendMessageRequest, 
  SendMessageResponse,
  MessagingStatus,
  ConversationInfo,
  UserProfile,
  ApiResponse,
  MessageEvent,
  ConversationEvent
} from '../types/MessagingTypes';

export class MessagingServiceV2 {
  private static instance: MessagingServiceV2;
  private channels: Map<string, RealtimeChannel> = new Map();
  private messageCallbacks: Map<string, (event: MessageEvent) => void> = new Map();
  private conversationCallbacks: Map<string, (event: ConversationEvent) => void> = new Map();
  private apiUrl: string;

  private constructor() {
    this.apiUrl = getApiUrl();
  }

  public static getInstance(): MessagingServiceV2 {
    if (!MessagingServiceV2.instance) {
      MessagingServiceV2.instance = new MessagingServiceV2();
    }
    return MessagingServiceV2.instance;
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      console.log('📤 MessagingServiceV2.sendMessage:', request);
      console.log('🌐 API URL:', this.apiUrl);

      // Get the user session with detailed debugging
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('🔑 Session debug for sendMessage:', {
        hasSession: !!session,
        sessionError: sessionError?.message,
        userId: session?.user?.id,
        tokenExists: !!session?.access_token,
        tokenLength: session?.access_token?.length,
        tokenPreview: session?.access_token?.substring(0, 20) + '...'
      });

      if (!session || !session.access_token) {
        throw new Error('User not authenticated - no session or token');
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      };

      console.log('🎯 Request headers:', {
        'Content-Type': headers['Content-Type'],
        'Authorization': `Bearer ${session.access_token.substring(0, 20)}...`
      });

      console.log('📦 Request body:', JSON.stringify(request, null, 2));

      const response = await fetch(`${this.apiUrl}/api/v1/messages-v2/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });

      console.log('🌐 Send message response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      let result: any;
      const responseText = await response.text();
      console.log('📄 Raw response text:', responseText);

      try {
        result = JSON.parse(responseText);
        console.log('📋 Parsed response:', result);
      } catch (parseError) {
        console.error('🚨 Failed to parse response as JSON:', parseError);
        throw new Error(`Invalid response format: ${responseText}`);
      }

      if (!response.ok) {
        console.error('🚨 HTTP Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: result
        });
        throw new Error(result?.error?.message || result?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to send message');
      }

      console.log('✅ Message sent successfully:', result.data);
      return result;
    } catch (error) {
      console.error('🚨 Error sending message:', error);
      console.error('🚨 Network error details:', {
        url: `${this.apiUrl}/api/v1/messages-v2/send`,
        error: error
      });
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    try {
      console.log('📥 MessagingServiceV2.getConversationMessages:', {
        conversationId,
        limit,
        offset
      });

      // Get the user session
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('🔑 Session check for getConversationMessages:', {
        hasSession: !!session,
        userId: session?.user?.id,
        tokenLength: session?.access_token?.length
      });
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(
        `${this.apiUrl}/api/v1/messages-v2/conversation/${conversationId}?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      const result: ApiResponse<Message[]> | any = await response.json();

      console.log('📥 API Response:', {
        status: response.status,
        success: result.success,
        error: result.error,
        dataLength: result.data?.length
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch messages');
      }

      console.log(`✅ Retrieved ${result.data?.length || 0} messages`);
      return result.data || [];
    } catch (error) {
      console.error('🚨 Error fetching messages:', error);
      return [];
    }
  }

  /**
   * Get all conversations for the current user
   */
  async getUserConversations(): Promise<Conversation[]> {
    try {
      console.log('📋 MessagingServiceV2.getUserConversations');

      // Debug authentication
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔑 Auth Debug:', {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        tokenExists: !!session?.access_token,
        tokenLength: session?.access_token?.length
      });
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${this.apiUrl}/api/v1/messages-v2/conversations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      console.log('🌐 API Response Details:', {
        url: `${this.apiUrl}/api/v1/messages-v2/conversations`,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const result: ApiResponse<Conversation[]> | any = await response.json();

      console.log('📋 API Response Body:', {
        success: result.success,
        error: result.error,
        dataLength: result.data?.length,
        rawResult: result
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch conversations');
      }

      console.log(`✅ Retrieved ${result.data?.length || 0} conversations`);
      return result.data || [];
    } catch (error) {
      console.error('🚨 Error fetching conversations:', error);
      console.error('🚨 Network error details:', {
        url: `${this.apiUrl}/api/v1/messages-v2/conversations`,
        error: error
      });
      return [];
    }
  }

  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      console.log('👁️ MessagingServiceV2.markMessageAsRead:', messageId);

      // Get the user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('User not authenticated');
        return false;
      }

      const response = await fetch(
        `${this.apiUrl}/api/v1/messages-v2/${messageId}/read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      const result: ApiResponse<{ read: boolean }> | any = await response.json();

      if (!result.success) {
        console.error('Failed to mark message as read:', result.error?.message);
        return false;
      }

      console.log('✅ Message marked as read');
      return result.data.read;
    } catch (error) {
      console.error('🚨 Error marking message as read:', error);
      return false;
    }
  }

  /**
   * Get conversation by shipment ID
   */
  async getConversationByShipment(shipmentId: string): Promise<ConversationInfo | null> {
    try {
      console.log('🚢 MessagingServiceV2.getConversationByShipment:', shipmentId);

      // Get the user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('User not authenticated');
        return null;
      }

      const response = await fetch(
        `${this.apiUrl}/api/v1/messages-v2/shipment/${shipmentId}/conversation`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      const result: ApiResponse<ConversationInfo> | any = await response.json();

      if (!result.success) {
        console.error('Failed to get conversation:', result.error?.message);
        return null;
      }

      console.log('✅ Conversation retrieved:', result.data);
      return result.data;
    } catch (error) {
      console.error('🚨 Error getting conversation:', error);
      return null;
    }
  }

  /**
   * Get messaging status for a conversation
   */
  async getMessagingStatus(conversationId: string): Promise<MessagingStatus | null> {
    try {
      console.log('📊 MessagingServiceV2.getMessagingStatus:', conversationId);

      // Get the user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('User not authenticated');
        return null;
      }

      const response = await fetch(
        `${this.apiUrl}/api/v1/messages-v2/conversation/${conversationId}/status`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      const result: ApiResponse<MessagingStatus> | any = await response.json();

      if (!result.success) {
        console.error('Failed to get messaging status:', result.error?.message);
        return null;
      }

      console.log('✅ Messaging status retrieved:', result.data);
      return result.data;
    } catch (error) {
      console.error('🚨 Error getting messaging status:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time conversation updates
   */
  subscribeToConversation(
    conversationId: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (message: Message) => void,
    onError?: (error: any) => void
  ): RealtimeChannel {
    const channelName = `conversation:${conversationId}`;
    
    console.log('🔌 Subscribing to conversation:', channelName);

    // Remove existing channel if it exists
    this.unsubscribeFromConversation(conversationId);

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          try {
            console.log('📨 New message received:', payload);
            
            // Get the full message with sender details
            const { data: fullMessage, error } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles!sender_id(*)
              `)
              .eq('id', payload.new.id)
              .single();

            if (error || !fullMessage) {
              console.error('Error fetching full message:', error);
              return;
            }

            const message: Message = {
              ...(fullMessage as any),
              sender: (fullMessage as any).sender as UserProfile
            };

            onNewMessage(message);
          } catch (error) {
            console.error('Error processing new message:', error);
            onError?.(error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          try {
            console.log('📝 Message updated:', payload);
            
            // Get the full message with sender details
            const { data: fullMessage, error } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles!sender_id(*)
              `)
              .eq('id', payload.new.id)
              .single();

            if (error || !fullMessage) {
              console.error('Error fetching updated message:', error);
              return;
            }

            const message: Message = {
              ...(fullMessage as any),
              sender: (fullMessage as any).sender as UserProfile
            };

            onMessageUpdate(message);
          } catch (error) {
            console.error('Error processing message update:', error);
            onError?.(error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to conversation:', channelName);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to conversation:', channelName);
          onError?.(new Error('Subscription failed'));
        }
      });

    this.channels.set(conversationId, channel);
    return channel;
  }

  /**
   * Unsubscribe from conversation updates
   */
  unsubscribeFromConversation(conversationId: string): void {
    const channel = this.channels.get(conversationId);
    if (channel) {
      console.log('🔌 Unsubscribing from conversation:', conversationId);
      supabase.removeChannel(channel);
      this.channels.delete(conversationId);
    }
  }

  /**
   * Subscribe to all user's conversations for real-time updates
   */
  subscribeToUserConversations(
    userId: string,
    onConversationUpdate: (event: ConversationEvent) => void,
    onError?: (error: any) => void
  ): RealtimeChannel {
    const channelName = `user_conversations:${userId}`;
    
    console.log('🔌 Subscribing to user conversations:', channelName);

    // Remove existing channel if it exists
    this.unsubscribeFromUserConversations(userId);

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `or(client_id.eq.${userId},driver_id.eq.${userId})`,
        },
        async (payload) => {
          try {
            console.log('🔄 Conversation updated:', payload);
            
            // Get the full conversation with related data
            const { data: fullConversation, error } = await supabase
              .from('conversations')
              .select(`
                *,
                shipment:shipments(*),
                client:profiles!client_id(*),
                driver:profiles!driver_id(*)
              `)
              .eq('id', (payload.new as any)?.id || (payload.old as any)?.id)
              .single();

            if (error || !fullConversation) {
              console.error('Error fetching full conversation:', error);
              return;
            }

            const eventType = payload.eventType === 'INSERT' ? 'CONVERSATION_CREATED' :
                             payload.eventType === 'UPDATE' ? 
                               ((payload.new as any).is_active && !(payload.old as any).is_active ? 'CONVERSATION_REACTIVATED' : 'CONVERSATION_EXPIRED') :
                             'CONVERSATION_EXPIRED';

            const event: ConversationEvent = {
              type: eventType,
              conversation: fullConversation as Conversation
            };

            onConversationUpdate(event);
          } catch (error) {
            console.error('Error processing conversation update:', error);
            onError?.(error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 User conversations subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to user conversations:', channelName);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to user conversations:', channelName);
          onError?.(new Error('Subscription failed'));
        }
      });

    this.channels.set(`user_${userId}`, channel);
    return channel;
  }

  /**
   * Unsubscribe from user conversations
   */
  unsubscribeFromUserConversations(userId: string): void {
    const channel = this.channels.get(`user_${userId}`);
    if (channel) {
      console.log('🔌 Unsubscribing from user conversations:', userId);
      supabase.removeChannel(channel);
      this.channels.delete(`user_${userId}`);
    }
  }

  /**
   * Disconnect all channels
   */
  disconnectAll(): void {
    console.log('🔌 Disconnecting all messaging channels');
    this.channels.forEach((channel, key) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.messageCallbacks.clear();
    this.conversationCallbacks.clear();
  }

  /**
   * Helper method to format message time
   */
  formatMessageTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Helper method to group messages by date
   */
  groupMessagesByDate(messages: Message[]): { date: string; messages: Message[] }[] {
    const groups: { [key: string]: Message[] } = {};

    messages.forEach(message => {
      const date = new Date(message.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return Object.entries(groups).map(([date, messages]) => ({
      date,
      messages: messages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }));
  }

  /**
   * Get message status (sent, delivered, read)
   */
  getMessageStatus(message: Message): 'sent' | 'delivered' | 'read' {
    if (message.read_at) return 'read';
    if (message.delivered_at) return 'delivered';
    return 'sent';
  }
}

// Export singleton instance
export const MessagingService = MessagingServiceV2.getInstance();