import { Alert } from 'react-native';
import { supabase } from '../supabase';
import NetworkUtil from './NetworkUtil';

/**
 * Utility functions for handling messaging in the app
 */
export const MessageUtil = {
  /**
   * Send a message securely, handling potential RLS and network errors
   * 
   * @param shipmentId - The ID of the shipment this message is related to
   * @param senderId - The user ID of the sender
   * @param content - The message content
   * @param receiverId - Optional receiver ID
   * @returns Object containing success status and error (if any)
   */
  async sendMessage(
    shipmentId: string,
    senderId: string,
    content: string,
    receiverId?: string
  ) {
    try {
      // Ensure we have network connectivity
      const isConnected = await NetworkUtil.isConnected();
      if (!isConnected) {
        Alert.alert(
          'No Internet Connection',
          'Please check your internet connection and try again.'
        );
        return { success: false, error: 'No internet connection' };
      }

      // Trim message content
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return { success: false, error: 'Message cannot be empty' };
      }

      // Try to use the RPC function for better security and validation
      const { data, error: rpcError } = await supabase.rpc('send_message', {
        p_shipment_id: shipmentId,
        p_content: trimmedContent,
        p_receiver_id: receiverId || null
      });
      
      // If RPC function doesn't exist, fall back to direct insert
      if (rpcError && rpcError.code === '42883') { // Function doesn't exist
        const { error } = await supabase
          .from('messages')
          .insert({
            shipment_id: shipmentId,
            sender_id: senderId,
            receiver_id: receiverId || null,
            content: trimmedContent,
            created_at: new Date().toISOString()
          });
          
        if (error) {
          // Handle row-level security policy violation
          if (error.code === '42501') { // Permission denied
            Alert.alert(
              'Permission Error',
              'You do not have permission to send this message. This might be because you are not associated with this shipment.'
            );
          } else if (error.code === '23503') { // Foreign key violation
            Alert.alert(
              'Error',
              'This message cannot be sent because the shipment or user no longer exists.'
            );
          } else {
            Alert.alert('Error', `Failed to send message: ${error.message}`);
          }
          return { success: false, error: error.message };
        }
      } else if (rpcError) {
        Alert.alert('Error', `Failed to send message: ${rpcError.message}`);
        return { success: false, error: rpcError.message };
      }
      
      return { success: true, error: null };
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'An unexpected error occurred while sending your message.');
      return { success: false, error: 'Unexpected error' };
    }
  },

  /**
   * Mark a message as read
   * 
   * @param messageId - The ID of the message to mark as read
   * @param userId - The user ID of the reader
   */
  async markAsRead(messageId: string, userId: string) {
    try {
      const { error } = await supabase.rpc('mark_message_as_read', {
        p_message_id: messageId,
        p_user_id: userId
      });
      
      if (error) {
        console.error('Error marking message as read:', error);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }
};
