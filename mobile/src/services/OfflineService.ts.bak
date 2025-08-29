// src/services/OfflineService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type ShipmentData = Database['public']['Tables']['shipments']['Row'];
type MessageData = Database['public']['Tables']['messages']['Row'];

// Keys for AsyncStorage
const SHIPMENTS_KEY = '@drivedrop:shipments';
const MESSAGES_KEY = '@drivedrop:messages';
const SYNC_TIMESTAMPS_KEY = '@drivedrop:sync_timestamps';

interface SyncTimestamps {
  shipments?: string;
  messages?: string;
}

export class OfflineService {
  private static instance: OfflineService;

  private constructor() {}

  public static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  /**
   * Save shipments data for offline access
   */
  async saveShipments(shipments: ShipmentData[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(shipments);
      await AsyncStorage.setItem(SHIPMENTS_KEY, jsonValue);
      await this.updateSyncTimestamp('shipments');
    } catch (error) {
      console.error('Error saving shipments offline:', error);
    }
  }

  /**
   * Get shipments from offline storage
   */
  async getOfflineShipments(): Promise<ShipmentData[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(SHIPMENTS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('Error getting offline shipments:', error);
      return [];
    }
  }

  /**
   * Save messages for offline access
   */
  async saveMessages(messages: MessageData[]): Promise<void> {
    try {
      const jsonValue = JSON.stringify(messages);
      await AsyncStorage.setItem(MESSAGES_KEY, jsonValue);
      await this.updateSyncTimestamp('messages');
    } catch (error) {
      console.error('Error saving messages offline:', error);
    }
  }

  /**
   * Get messages from offline storage
   */
  async getOfflineMessages(): Promise<MessageData[]> {
    try {
      const jsonValue = await AsyncStorage.getItem(MESSAGES_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('Error getting offline messages:', error);
      return [];
    }
  }

  /**
   * Update the timestamp of when data was last synced
   */
  private async updateSyncTimestamp(
    type: 'shipments' | 'messages'
  ): Promise<void> {
    try {
      const timestamps = await this.getSyncTimestamps();
      timestamps[type] = new Date().toISOString();
      await AsyncStorage.setItem(
        SYNC_TIMESTAMPS_KEY,
        JSON.stringify(timestamps)
      );
    } catch (error) {
      console.error('Error updating sync timestamp:', error);
    }
  }

  /**
   * Get the timestamps of when data was last synced
   */
  async getSyncTimestamps(): Promise<SyncTimestamps> {
    try {
      const jsonValue = await AsyncStorage.getItem(SYNC_TIMESTAMPS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : {};
    } catch (error) {
      console.error('Error getting sync timestamps:', error);
      return {};
    }
  }

  /**
   * Sync shipments with Supabase
   * This will fetch the latest shipments and store them locally
   */
  async syncShipments(userId: string): Promise<ShipmentData[]> {
    try {
      // Get the user's shipments from Supabase
      const { data: clientShipments, error: clientError } = await supabase
        .from('shipments')
        .select('*')
        .eq('client_id', userId);

      if (clientError) {
        throw clientError;
      }

      // If user is a driver, also get their assigned shipments
      const { data: driverShipments, error: driverError } = await supabase
        .from('shipments')
        .select('*')
        .eq('driver_id', userId);

      if (driverError) {
        throw driverError;
      }

      // Combine both sets of shipments and remove duplicates
      const allShipments = [
        ...(clientShipments || []),
        ...(driverShipments || []),
      ];
      const uniqueShipments = allShipments.filter(
        (shipment, index, self) =>
          index === self.findIndex(s => s.id === shipment.id)
      );

      // Save shipments to offline storage
      await this.saveShipments(uniqueShipments);

      return uniqueShipments;
    } catch (error) {
      console.error('Error syncing shipments:', error);
      // Return what we have in offline storage
      return await this.getOfflineShipments();
    }
  }

  /**
   * Sync messages with Supabase
   * This will fetch the latest messages for a shipment and store them locally
   */
  async syncMessages(shipmentId: string): Promise<MessageData[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Save messages to offline storage
      if (data) {
        await this.saveMessages(data);
      }

      return data || [];
    } catch (error) {
      console.error('Error syncing messages:', error);
      // Return what we have in offline storage
      const allMessages = await this.getOfflineMessages();
      return allMessages.filter(msg => msg.shipment_id === shipmentId);
    }
  }

  /**
   * Queue a message to be sent when online
   */
  async queueMessage(
    message: Omit<MessageData, 'id' | 'created_at'>
  ): Promise<void> {
    try {
      // Store the queue in AsyncStorage
      const queueKey = `@drivedrop:message_queue`;
      const queueJson = await AsyncStorage.getItem(queueKey);
      const queue = queueJson ? JSON.parse(queueJson) : [];

      // Add message to queue
      queue.push({
        ...message,
        queued_at: new Date().toISOString(),
      });

      await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
    } catch (error) {
      console.error('Error queueing message:', error);
    }
  }

  /**
   * Process queued messages
   */
  async processQueuedMessages(): Promise<void> {
    try {
      // Get the queue
      const queueKey = `@drivedrop:message_queue`;
      const queueJson = await AsyncStorage.getItem(queueKey);
      if (!queueJson) return;

      const queue = JSON.parse(queueJson);
      if (queue.length === 0) return;

      // Try to send each message
      const newQueue = [];

      for (const message of queue) {
        try {
          // Try to insert the message
          const { error } = await supabase.from('messages').insert({
            shipment_id: message.shipment_id,
            sender_id: message.sender_id,
            content: message.content,
            is_read: message.is_read || false,
          });

          if (error) {
            // Keep in queue if failed
            newQueue.push(message);
          }
        } catch (error) {
          // Keep in queue if failed
          newQueue.push(message);
        }
      }

      // Update the queue
      await AsyncStorage.setItem(queueKey, JSON.stringify(newQueue));
    } catch (error) {
      console.error('Error processing message queue:', error);
    }
  }

  /**
   * Clear all offline data (for logout)
   */
  async clearOfflineData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        SHIPMENTS_KEY,
        MESSAGES_KEY,
        SYNC_TIMESTAMPS_KEY,
        '@drivedrop:message_queue',
      ]);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }
}

// Export singleton instance
export const offlineService = OfflineService.getInstance();
