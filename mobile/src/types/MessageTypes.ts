/**
 * Types for messaging functionality - Redesigned for clean realtime implementation
 */

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  role: 'client' | 'driver' | 'admin';
  notifications_last_viewed_at?: string;
}

export interface Message {
  id: string;
  shipment_id: string;
  sender_id: string;
  receiver_id: string | null;
  content: string;
  message_type: 'text' | 'system' | 'notification';
  is_read: boolean;
  read_at?: string;
  created_at: string;
  expires_at: string;
  metadata?: Record<string, any>;
  sender: UserProfile;
  receiver?: UserProfile;
}

export interface Conversation {
  shipment_id: string;
  shipment_title: string;
  shipment_status: string;
  other_participant: UserProfile;
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
  messaging_allowed: boolean;
  expires_at?: string;
}

export interface MessageGroup {
  date: string;
  messages: Message[];
}

export interface SendMessageRequest {
  shipment_id: string;
  content: string;
  receiver_id?: string;
  message_type?: 'text' | 'system' | 'notification';
}

export interface SendMessageResponse {
  success: boolean;
  message?: Message;
  error?: string;
}

export interface MessagingStatus {
  allowed: boolean;
  reason?: string;
  expires_at?: string;
}

// Contact interface for backward compatibility
export interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  shipmentId?: string;
  shipmentStatus?: string;
  isAdmin?: boolean;
  role?: string;
}
