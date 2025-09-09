/**
 * Clean Messaging Service - Redesigned for reliable real-time communication
 * 
 * Features:
 * - Role-based messaging permissions
 * - 24-hour expiry for completed shipments
 * - Real-time message delivery
 * - Automatic message cleanup
 * - Admin can message anyone anytime
 */

import { supabase } from '../lib/supabase';
import { 
  Message, 
  Conversation, 
  SendMessageRequest, 
  SendMessageResponse, 
  MessagingStatus,
  UserProfile
} from '../types/MessageTypes';
import { RealtimeChannel } from '@supabase/supabase-js';

export class MessagingService {
  private static instance: MessagingService;
  private channels: Map<string, RealtimeChannel> = new Map();

  private constructor() {}

  public static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
  }

  /**
   * Check if messaging is allowed for a specific shipment
   */
  async checkMessagingStatus(shipmentId: string, userId?: string): Promise<MessagingStatus> {
    try {
      const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id;
      
      const { data, error } = await supabase.rpc('is_messaging_allowed', {
        p_shipment_id: shipmentId,
        p_user1_id: currentUserId,
        p_user2_id: null
      } as any);

      if (error) throw error;

      // Get shipment details for expiry info
      const { data: shipment } = await supabase
        .from('shipments')
        .select('status, updated_at')
        .eq('id', shipmentId)
        .single();

      let expiresAt = undefined;
      if ((shipment as any)?.status === 'delivered') {
        const updatedAt = new Date((shipment as any).updated_at);
        expiresAt = new Date(updatedAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
      }

      return {
        allowed: data === true,
        expires_at: expiresAt,
        reason: data === false ? 'Messaging not allowed for this shipment or expired' : undefined
      };
    } catch (error) {
      console.error('Error checking messaging status:', error);
      return { allowed: false, reason: 'Failed to check messaging status' };
    }
  }

  /**
   * Send a message using the database function
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      console.log('🚀 SendMessage called with request:', JSON.stringify(request, null, 2));
      
      // Validate request
      if (!request.content?.trim()) {
        console.log('❌ Validation failed: Message content cannot be empty');
        return { success: false, error: 'Message content cannot be empty' };
      }

      if (request.content.length > 2000) {
        console.log('❌ Validation failed: Message too long');
        return { success: false, error: 'Message too long (max 2000 characters)' };
      }

      const rpcParams = {
        p_shipment_id: request.shipment_id,
        p_content: request.content.trim(),
        p_receiver_id: request.receiver_id || null,
        p_message_type: request.message_type || 'text'
      };
      
      console.log('📤 Calling send_message_v2 with params:', JSON.stringify(rpcParams, null, 2));

      const { data, error } = await supabase.rpc('send_message_v2', rpcParams as any);

      if (error) {
        console.error('❌ Database error from send_message_v2:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        console.error('❌ Error code:', error.code);
        console.error('❌ Error hint:', error.hint);
        console.error('❌ Error details:', error.details);
        
        // Handle specific error types
        let friendlyMessage = error.message || 'Failed to send message';
        if (error.message?.includes('Missing required fields')) {
          friendlyMessage = 'Database validation error. Please check if shipment and user data exists.';
        } else if (error.message?.includes('not found')) {
          friendlyMessage = 'Shipment not found. Please select a valid conversation.';
        } else if (error.message?.includes('not allowed')) {
          friendlyMessage = 'Messaging not allowed for this shipment or has expired.';
        } else if (error.message?.includes('authenticated')) {
          friendlyMessage = 'Please log in to send messages.';
        }
        
        return { 
          success: false, 
          error: friendlyMessage
        };
      }

      console.log('✅ Database response:', JSON.stringify(data, null, 2));

      if (data && (data as any).success) {
        console.log('✅ Message sent successfully, message ID:', (data as any).message_id);
        return {
          success: true,
          message: {
            id: (data as any).message_id,
            content: request.content.trim(),
            sender_id: (data as any).sender_id,
            receiver_id: request.receiver_id || null,
            shipment_id: request.shipment_id,
            message_type: request.message_type || 'text',
            created_at: new Date().toISOString(),
            is_read: false,
            expires_at: null,
            sender: null
          } as any
        };
      } else {
        console.log('❌ Database returned unsuccessful response:', data);
        return { 
          success: false, 
          error: (data as any)?.error || 'Failed to send message' 
        };
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get conversation messages for a shipment
   */
  async getConversationMessages(
    shipmentId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<Message[]> {
    try {
      const { data, error } = await supabase.rpc('get_conversation_messages', {
        p_shipment_id: shipmentId,
        p_limit: limit,
        p_offset: offset
      } as any);

      if (error) throw error;

      return (data as Message[]) || [];
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      return [];
    }
  }

  /**
   * Get all conversations for the current user
   */
  async getUserConversations(): Promise<Conversation[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_conversations');

      if (error) throw error;

      return (data as Conversation[]) || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('mark_message_as_read', {
        p_message_id: messageId
      } as any);

      if (error) throw error;

      return data === true;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time messages for a specific shipment
   */
  subscribeToConversation(
    shipmentId: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (message: Message) => void,
    onError?: (error: any) => void
  ): RealtimeChannel {
    const channelName = `conversation:${shipmentId}`;
    
    // Remove existing channel if it exists
    this.unsubscribeFromConversation(shipmentId);

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        async (payload) => {
          try {
            // Get the full message with user details
            const { data: fullMessage, error } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles!sender_id(*),
                receiver:profiles!receiver_id(*)
              `)
              .eq('id', payload.new.id)
              .single();

            if (error) throw error;

            onNewMessage(fullMessage as Message);
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
          filter: `shipment_id=eq.${shipmentId}`,
        },
        async (payload) => {
          try {
            // Get the full updated message with user details
            const { data: fullMessage, error } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles!sender_id(*),
                receiver:profiles!receiver_id(*)
              `)
              .eq('id', payload.new.id)
              .single();

            if (error) throw error;

            onMessageUpdate(fullMessage as Message);
          } catch (error) {
            console.error('Error processing message update:', error);
            onError?.(error);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to conversation: ${shipmentId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error for conversation:', shipmentId);
          onError?.(new Error('Real-time subscription failed'));
        }
      });

    this.channels.set(shipmentId, channel);
    return channel;
  }

  /**
   * Unsubscribe from a conversation
   */
  unsubscribeFromConversation(shipmentId: string): void {
    const channel = this.channels.get(shipmentId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(shipmentId);
      console.log(`Unsubscribed from conversation: ${shipmentId}`);
    }
  }

  /**
   * Subscribe to all conversations for the current user
   */
  subscribeToAllConversations(
    onConversationUpdate: (conversation: Conversation) => void,
    onError?: (error: any) => void
  ): RealtimeChannel {
    const channelName = 'user-conversations';
    
    // Remove existing channel if it exists
    this.unsubscribeFromAllConversations();

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          try {
            // Refresh conversations when any message changes
            const conversations = await this.getUserConversations();
            // Find the affected conversation
            const affectedConversation = conversations.find(
              conv => conv.shipment_id === (payload.new as any)?.shipment_id || 
                      conv.shipment_id === (payload.old as any)?.shipment_id
            );
            
            if (affectedConversation) {
              onConversationUpdate(affectedConversation);
            }
          } catch (error) {
            console.error('Error processing conversation update:', error);
            onError?.(error);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to all conversations');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error for all conversations');
          onError?.(new Error('Conversations subscription failed'));
        }
      });

    this.channels.set('all-conversations', channel);
    return channel;
  }

  /**
   * Unsubscribe from all conversations
   */
  unsubscribeFromAllConversations(): void {
    const channel = this.channels.get('all-conversations');
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete('all-conversations');
      console.log('Unsubscribed from all conversations');
    }
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    for (const [key, channel] of this.channels) {
      supabase.removeChannel(channel);
      console.log(`Cleaned up subscription: ${key}`);
    }
    this.channels.clear();
  }

  /**
   * Get available contacts for messaging (based on user's shipments)
   */
  async getAvailableContacts(): Promise<{
    clients: UserProfile[];
    drivers: UserProfile[];
    admins: UserProfile[];
  }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.user.id)
        .single();

      let contacts: {
        clients: UserProfile[];
        drivers: UserProfile[];
        admins: UserProfile[];
      } = { clients: [], drivers: [], admins: [] };

      if ((profile as any)?.role === 'admin') {
        // Admins can message anyone
        const { data: allUsers } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, role')
          .neq('id', user.user.id);

        if (allUsers) {
          allUsers.forEach((u: any) => {
            const user: UserProfile = {
              id: u.id,
              first_name: u.first_name,
              last_name: u.last_name,
              avatar_url: u.avatar_url,
              role: u.role as 'client' | 'driver' | 'admin'
            };
            if (user.role === 'client') contacts.clients.push(user);
            else if (user.role === 'driver') contacts.drivers.push(user);
            else if (user.role === 'admin') contacts.admins.push(user);
          });
        }
      } else {
        // Get contacts from active shipments
        const { data: shipments } = await supabase
          .from('shipments')
          .select(`
            id,
            status,
            client_id,
            driver_id,
            updated_at,
            client:profiles!client_id(id, first_name, last_name, avatar_url, role),
            driver:profiles!driver_id(id, first_name, last_name, avatar_url, role)
          `)
          .or(`client_id.eq.${user.user.id},driver_id.eq.${user.user.id}`)
          .not('driver_id', 'is', null)
          .in('status', ['accepted', 'picked_up', 'in_transit', 'delivered']);

        if (shipments) {
          const contactMap = new Map<string, UserProfile>();
          
          shipments.forEach((shipment: any) => {
            // Only include contacts if messaging is allowed
            const isRecentlyDelivered = shipment.status === 'delivered' && 
              new Date().getTime() - new Date(shipment.updated_at).getTime() < 24 * 60 * 60 * 1000;
            
            if (shipment.status !== 'delivered' || isRecentlyDelivered) {
              if ((profile as any)?.role === 'client' && shipment.driver) {
                const driver = Array.isArray(shipment.driver) ? shipment.driver[0] : shipment.driver;
                if (driver) {
                  const driverProfile: UserProfile = {
                    id: driver.id,
                    first_name: driver.first_name,
                    last_name: driver.last_name,
                    avatar_url: driver.avatar_url,
                    role: driver.role as 'client' | 'driver' | 'admin'
                  };
                  contactMap.set(driver.id, driverProfile);
                }
              } else if ((profile as any)?.role === 'driver' && shipment.client) {
                const client = Array.isArray(shipment.client) ? shipment.client[0] : shipment.client;
                if (client) {
                  const clientProfile: UserProfile = {
                    id: client.id,
                    first_name: client.first_name,
                    last_name: client.last_name,
                    avatar_url: client.avatar_url,
                    role: client.role as 'client' | 'driver' | 'admin'
                  };
                  contactMap.set(client.id, clientProfile);
                }
              }
            }
          });

          contacts.drivers = Array.from(contactMap.values()).filter((c: UserProfile) => c.role === 'driver');
          contacts.clients = Array.from(contactMap.values()).filter((c: UserProfile) => c.role === 'client');
        }

        // Always add admins for support
        const { data: admins } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, role')
          .eq('role', 'admin');

        if (admins) {
          contacts.admins = admins.map((admin: any): UserProfile => ({
            id: admin.id,
            first_name: admin.first_name,
            last_name: admin.last_name,
            avatar_url: admin.avatar_url,
            role: admin.role as 'client' | 'driver' | 'admin'
          }));
        }
      }

      return contacts;
    } catch (error) {
      console.error('Error fetching available contacts:', error);
      return { clients: [], drivers: [], admins: [] };
    }
  }
}

export default MessagingService.getInstance();
