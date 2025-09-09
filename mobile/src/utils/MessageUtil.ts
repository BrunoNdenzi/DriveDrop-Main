/**
 * Message Utility Functions - Redesigned for clean messaging implementation
 * 
 * This utility provides backward compatibility while using the new messaging system
 */

import { Alert } from 'react-native';
import MessagingService from '../services/MessagingService';
import { SendMessageRequest } from '../types/MessageTypes';

/**
 * Legacy MessageUtil for backward compatibility
 */
export const MessageUtil = {
  /**
   * Send a message securely using the new messaging service
   * 
   * @param shipmentId - The ID of the shipment this message is related to
   * @param senderId - The user ID of the sender (for compatibility, not used)
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
      // Validate inputs
      if (!shipmentId || !content?.trim()) {
        Alert.alert('Error', 'Shipment ID and message content are required');
        return { success: false, error: 'Missing required fields' };
      }

      const request: SendMessageRequest = {
        shipment_id: shipmentId,
        content: content.trim(),
        receiver_id: receiverId,
        message_type: 'text'
      };

      const response = await MessagingService.sendMessage(request);
      
      if (!response.success) {
        Alert.alert('Error', response.error || 'Failed to send message');
      }

      return response;
    } catch (error) {
      console.error('Error in MessageUtil.sendMessage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to send message: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Mark a message as read
   * 
   * @param messageId - The ID of the message to mark as read
   * @param userId - The user ID of the reader (for compatibility, not used)
   */
  async markAsRead(messageId: string, userId: string) {
    try {
      const success = await MessagingService.markMessageAsRead(messageId);
      if (!success) {
        console.warn('Failed to mark message as read:', messageId);
      }
      return success;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  },

  /**
   * Check if messaging is allowed for a shipment
   * 
   * @param shipmentId - The shipment ID to check
   * @param userId - The user ID (optional)
   */
  async isMessagingAllowed(shipmentId: string, userId?: string) {
    try {
      const status = await MessagingService.checkMessagingStatus(shipmentId, userId);
      return status.allowed;
    } catch (error) {
      console.error('Error checking messaging status:', error);
      return false;
    }
  }
};

export default MessageUtil;
