/**
 * Messages controller for handling messaging API endpoints
 */
import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';



interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Utility functions
const successResponse = (data: any, message = 'Success') => ({
  success: true,
  message,
  data,
});

const errorResponse = (message: string, code = 'ERROR') => ({
  success: false,
  error: {
    message,
    code,
  },
});

const createError = (message: string, statusCode: number, code: string) => {
  const error = new Error(message) as any;
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res, next)).catch((error: any) => {
    console.error('Async handler error:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.code));
    }
    return res.status(500).json(errorResponse('Internal server error', 'INTERNAL_ERROR'));
  });
};

/**
 * Send a message
 */
export const sendMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { shipment_id, content, receiver_id, message_type = 'text' } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED'));
  }

  if (!shipment_id || !content?.trim()) {
    return res.status(400).json(errorResponse('Shipment ID and content are required', 'INVALID_INPUT'));
  }

  if (content.length > 2000) {
    return res.status(400).json(errorResponse('Message content too long (max 2000 characters)', 'CONTENT_TOO_LONG'));
  }

  try {
    // Call the database function to send message with validation
    const { data, error } = await supabase.rpc('send_message_v2', {
      p_shipment_id: shipment_id,
      p_content: content.trim(),
      p_receiver_id: receiver_id || null,
      p_message_type: message_type
    });

    if (error) {
      console.error('Database error sending message:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    return res.status(201).json(successResponse(data, 'Message sent successfully'));
  } catch (error: any) {
    console.error('Error sending message:', error);
    return res.status(500).json(errorResponse('Failed to send message', 'SEND_MESSAGE_FAILED'));
  }
});

/**
 * Get conversation messages
 */
export const getConversationMessages = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { shipmentId } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED'));
  }

  if (!shipmentId) {
    return res.status(400).json(errorResponse('Shipment ID is required', 'INVALID_INPUT'));
  }

  try {
    // Call the database function to get conversation messages
    const { data, error } = await supabase.rpc('get_conversation_messages', {
      p_shipment_id: shipmentId,
      p_limit: parseInt(limit as string),
      p_offset: parseInt(offset as string)
    });

    if (error) {
      console.error('Database error fetching messages:', error);
      if (error.message.includes('Access denied')) {
        return res.status(403).json(errorResponse('Access denied to this conversation', 'ACCESS_DENIED'));
      }
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    return res.json(successResponse(data || [], 'Messages retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching conversation messages:', error);
    return res.status(500).json(errorResponse('Failed to fetch messages', 'FETCH_MESSAGES_FAILED'));
  }
});

/**
 * Get user conversations
 */
export const getUserConversations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED'));
  }

  try {
    // Call the database function to get user conversations
    const { data, error } = await supabase.rpc('get_user_conversations', {
      p_user_id: userId
    });

    if (error) {
      console.error('Database error fetching conversations:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    return res.json(successResponse(data || [], 'Conversations retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching user conversations:', error);
    return res.status(500).json(errorResponse('Failed to fetch conversations', 'FETCH_CONVERSATIONS_FAILED'));
  }
});

/**
 * Mark message as read
 */
export const markMessageAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED'));
  }

  if (!messageId) {
    return res.status(400).json(errorResponse('Message ID is required', 'INVALID_INPUT'));
  }

  try {
    // Call the database function to mark message as read
    const { data, error } = await supabase.rpc('mark_message_as_read', {
      p_message_id: messageId,
      p_user_id: userId
    });

    if (error) {
      console.error('Database error marking message as read:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    return res.json(successResponse({ success: data }, 'Message marked as read'));
  } catch (error: any) {
    console.error('Error marking message as read:', error);
    return res.status(500).json(errorResponse('Failed to mark message as read', 'MARK_READ_FAILED'));
  }
});

/**
 * Check messaging status
 */
export const checkMessagingStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { shipmentId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED'));
  }

  if (!shipmentId) {
    return res.status(400).json(errorResponse('Shipment ID is required', 'INVALID_INPUT'));
  }

  try {
    // Check if messaging is allowed
    const { data: isAllowed, error: statusError } = await supabase.rpc('is_messaging_allowed', {
      p_shipment_id: shipmentId,
      p_user1_id: userId
    });

    if (statusError) {
      console.error('Database error checking messaging status:', statusError);
      return res.status(400).json(errorResponse(statusError.message, 'DATABASE_ERROR'));
    }

    // Get shipment details for expiry info
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('status, updated_at, client_id, driver_id')
      .eq('id', shipmentId)
      .single();

    if (shipmentError) {
      console.error('Error fetching shipment:', shipmentError);
      return res.status(404).json(errorResponse('Shipment not found', 'SHIPMENT_NOT_FOUND'));
    }

    let expiresAt = null;
    if (shipment.status === 'delivered') {
      const updatedAt = new Date(shipment.updated_at);
      expiresAt = new Date(updatedAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }

    const status = {
      allowed: isAllowed === true,
      expires_at: expiresAt,
      reason: isAllowed === false ? 'Messaging not allowed for this shipment or expired' : null,
      shipment_status: shipment.status
    };

    return res.json(successResponse(status, 'Messaging status retrieved'));
  } catch (error: any) {
    console.error('Error checking messaging status:', error);
    return res.status(500).json(errorResponse('Failed to check messaging status', 'CHECK_STATUS_FAILED'));
  }
});

/**
 * Get available contacts for messaging
 */
export const getAvailableContacts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  try {
    let contacts: { clients: any[]; drivers: any[]; admins: any[] } = { 
      clients: [], 
      drivers: [], 
      admins: [] 
    };

    if (userRole === 'admin') {
      // Admins can message anyone
      const { data: allUsers, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, role')
        .neq('id', userId);

      if (error) {
        throw createError('Failed to fetch users', 500, 'FETCH_USERS_FAILED');
      }

      if (allUsers) {
        allUsers.forEach((user: any) => {
          if (user.role === 'client') contacts.clients.push(user);
          else if (user.role === 'driver') contacts.drivers.push(user);
          else if (user.role === 'admin') contacts.admins.push(user);
        });
      }
    } else {
      // Get contacts from active shipments
      const { data: shipments, error: shipmentsError } = await supabase
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
        .or(`client_id.eq.${userId},driver_id.eq.${userId}`)
        .not('driver_id', 'is', null)
        .in('status', ['accepted', 'picked_up', 'in_transit', 'delivered']);

      if (shipmentsError) {
        throw createError('Failed to fetch shipments', 500, 'FETCH_SHIPMENTS_FAILED');
      }

      if (shipments) {
        const contactMap = new Map();
        
        shipments.forEach((shipment: any) => {
          // Only include contacts if messaging is allowed
          const isRecentlyDelivered = shipment.status === 'delivered' && 
            new Date().getTime() - new Date(shipment.updated_at).getTime() < 24 * 60 * 60 * 1000;
          
          if (shipment.status !== 'delivered' || isRecentlyDelivered) {
            if (userRole === 'client' && shipment.driver) {
              contactMap.set(shipment.driver.id, shipment.driver);
            } else if (userRole === 'driver' && shipment.client) {
              contactMap.set(shipment.client.id, shipment.client);
            }
          }
        });

        const allContacts = Array.from(contactMap.values());
        contacts.drivers = allContacts.filter((c: any) => c.role === 'driver');
        contacts.clients = allContacts.filter((c: any) => c.role === 'client');
      }

      // Always add admins for support
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, role')
        .eq('role', 'admin');

      if (adminsError) {
        console.error('Error fetching admins:', adminsError);
      } else if (admins) {
        contacts.admins = admins;
      }
    }

    return res.json(successResponse(contacts, 'Available contacts retrieved'));
  } catch (error: any) {
    console.error('Error fetching available contacts:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.code));
    }
    return res.status(500).json(errorResponse('Failed to fetch contacts', 'FETCH_CONTACTS_FAILED'));
  }
});
