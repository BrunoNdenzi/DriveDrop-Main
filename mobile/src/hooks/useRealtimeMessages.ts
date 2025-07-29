// src/hooks/useRealtimeMessages.ts
import { useEffect, useState } from 'react';
import { realtimeService } from '../services/RealtimeService';
import { Database } from '../lib/database.types';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Type definitions
type MessageData = Database['public']['Tables']['messages']['Row'];
type NewMessage = Database['public']['Tables']['messages']['Insert'];

/**
 * Hook for real-time messaging functionality
 * 
 * @param shipmentId The ID of the shipment for messaging context
 * @returns Object containing messages, loading state, error state, and functions to send/mark messages as read
 * 
 * @example
 * ```tsx
 * // In a chat component:
 * const { 
 *   messages, 
 *   loading, 
 *   error, 
 *   sendMessage, 
 *   markAsRead 
 * } = useRealtimeMessages(shipmentId);
 * 
 * // Send a new message
 * const handleSend = () => {
 *   sendMessage(messageText);
 * };
 * 
 * // Messages will update in real-time
 * return (
 *   <FlatList
 *     data={messages}
 *     renderItem={({item}) => (
 *       <MessageBubble 
 *         message={item} 
 *         onPress={() => markAsRead(item.id)}
 *       />
 *     )}
 *   />
 * );
 * ```
 */
export function useRealtimeMessages(shipmentId: string) {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Fetch existing messages when the component mounts
  useEffect(() => {
    if (!shipmentId) return;
    
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('shipment_id', shipmentId)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };
    
    fetchMessages();
    
    // Handler for new messages
    const handleNewMessage = (message: MessageData) => {
      setMessages(prev => {
        // Check if we already have this message to avoid duplicates
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
    };
    
    // Subscribe to new messages
    const newChannel = supabase.channel(`messages:${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          handleNewMessage(payload.new as MessageData);
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
        (payload) => {
          console.log('Message updated:', payload);
          // Update the message in our state
          setMessages(prev => 
            prev.map(msg => 
              msg.id === payload.new.id ? (payload.new as MessageData) : msg
            )
          );
        }
      )
      .subscribe();
      
    setChannel(newChannel);
    
    // Cleanup function
    return () => {
      if (newChannel) {
        supabase.removeChannel(newChannel);
      }
    };
  }, [shipmentId]);
  
  // Function to send a new message
  const sendMessage = async (content: string, senderId: string) => {
    if (!content.trim() || !shipmentId || !senderId) return;
    
    try {
      const newMessage: NewMessage = {
        shipment_id: shipmentId,
        sender_id: senderId,
        content: content.trim(),
        is_read: false,
      };
      
      const { error } = await supabase.from('messages').insert(newMessage);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };
  
  // Function to mark a message as read
  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase.rpc('mark_message_as_read', {
        p_message_id: messageId,
        p_user_id: (await supabase.auth.getUser()).data.user?.id
      });
      
      if (error) throw error;
      
      // Update local state to show message as read
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };
  
  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    channel
  };
}
