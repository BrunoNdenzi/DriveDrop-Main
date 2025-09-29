/**
 * NEW MESSAGING SYSTEM V2 - Types
 * Complete re-implementation from scratch maintaining design and functionality
 */

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  role: 'client' | 'driver' | 'admin';
  email?: string;
  phone?: string;
}

export interface Conversation {
  id: string;
  shipment_id: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  
  // Shipment details
  shipment?: {
    id: string;
    title: string;
    status: string;
    pickup_address: string;
    delivery_address: string;
  };
  
  // For regular users - the other participant
  other_participant?: UserProfile;
  
  // For admin users - both participants
  client?: UserProfile;
  driver?: UserProfile;
  
  // Last message info
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  
  // Unread count for current user
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'system' | 'notification';
  
  // Message status tracking
  sent_at: string;
  delivered_at?: string;
  read_at?: string;
  
  created_at: string;
  metadata?: Record<string, any>;
  
  // Sender information
  sender: UserProfile;
}

export interface MessageGroup {
  date: string;
  messages: Message[];
}

export interface SendMessageRequest {
  conversation_id: string;
  content: string;
  message_type?: 'text' | 'system' | 'notification';
}

export interface SendMessageResponse {
  success: boolean;
  message: string;
  data: Message;
}

export interface MessagingStatus {
  conversation_id: string;
  is_active: boolean;
  can_access: boolean;
  expires_at?: string;
  shipment_status?: string;
  participants: {
    client_id: string;
    driver_id: string;
  };
}

export interface ConversationInfo {
  id: string;
  shipment_id: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  can_access: boolean;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code: string;
  };
}

// Hook options and return types
export interface UseMessagingOptions {
  conversationId?: string;
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
  sendMessage: (content: string, messageType?: 'text' | 'system' | 'notification') => Promise<boolean>;
  markAsRead: (messageId: string) => Promise<boolean>;
  loadMoreMessages: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  connect: () => void;
  disconnect: () => void;
  clearError: () => void;
  getConversationByShipment: (shipmentId: string) => Promise<ConversationInfo | null>;
}

// Real-time event types
export interface MessageEvent {
  type: 'NEW_MESSAGE' | 'MESSAGE_READ' | 'MESSAGE_DELIVERED';
  message: Message;
  conversation_id: string;
}

export interface ConversationEvent {
  type: 'CONVERSATION_CREATED' | 'CONVERSATION_EXPIRED' | 'CONVERSATION_REACTIVATED';
  conversation: Conversation;
}

// Utility types for message status
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface MessageWithStatus extends Message {
  status: MessageStatus;
}

// Search and filter types
export interface ConversationFilter {
  active_only?: boolean;
  include_expired?: boolean;
  shipment_status?: string[];
}

export interface MessageFilter {
  message_type?: ('text' | 'system' | 'notification')[];
  unread_only?: boolean;
  date_range?: {
    start: string;
    end: string;
  };
}

// Admin specific types
export interface AdminConversationView extends Conversation {
  client: UserProfile;
  driver: UserProfile;
  message_count: number;
  last_activity: string;
}

export interface ConversationAnalytics {
  total_conversations: number;
  active_conversations: number;
  expired_conversations: number;
  total_messages: number;
  unread_messages: number;
  average_response_time?: number;
}

// Legacy compatibility types (for gradual migration)
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

// Export all types as default for easy importing
export default {
  UserProfile,
  Conversation,
  Message,
  MessageGroup,
  SendMessageRequest,
  SendMessageResponse,
  MessagingStatus,
  ConversationInfo,
  ApiResponse,
  ApiError,
  UseMessagingOptions,
  UseMessagingReturn,
  MessageEvent,
  ConversationEvent,
  MessageStatus,
  MessageWithStatus,
  ConversationFilter,
  MessageFilter,
  AdminConversationView,
  ConversationAnalytics,
  Contact
};