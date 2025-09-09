declare module '../types/MessageTypes' {
  export interface Message {
    id: string;
    sender_id: string;
    receiver_id: string | null;
    content: string;
    created_at: string;
    is_read: boolean;
    shipment_id: string;
  }
  
  export interface MessageGroup {
    date: string;
    messages: Message[];
  }
  
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
}
