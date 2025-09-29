/**
 * NEW MESSAGING SYSTEM V2 - Backend Controller
 * Complete re-implementation from scratch
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

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res, next)).catch((error: any) => {
    console.error('🚨 Messaging Controller Error:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.code));
    }
    return res.status(500).json(errorResponse('Internal server error', 'INTERNAL_ERROR'));
  });
};

/**
 * Send a message in a conversation
 */
export const sendMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('📤 Send Message Request:', {
    user: req.user?.id,
    body: req.body
  });

  const { conversation_id, content, message_type = 'text' } = req.body;
  const userId = req.user?.id;

  // Validation
  if (!userId) {
    return res.status(401).json(errorResponse('User not authenticated', 'UNAUTHORIZED'));
  }

  if (!conversation_id) {
    return res.status(400).json(errorResponse('Conversation ID is required', 'MISSING_CONVERSATION_ID'));
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json(errorResponse('Message content is required', 'MISSING_CONTENT'));
  }

  if (content.trim().length > 2000) {
    return res.status(400).json(errorResponse('Message content too long (max 2000 characters)', 'CONTENT_TOO_LONG'));
  }

  try {
    // First check if user can access this conversation
    console.log('🔍 Checking conversation access:', {
      conversationId: conversation_id,
      userId: userId
    });

    const { data: conversationCheck, error: conversationError } = await supabase
      .from('conversations')
      .select(`
        id,
        is_active,
        expires_at,
        driver_id,
        client_id,
        shipment_id
      `)
      .eq('id', conversation_id)
      .maybeSingle(); // Use maybeSingle to handle no results gracefully

    console.log('📋 Conversation check result:', {
      found: !!conversationCheck,
      error: conversationError?.message,
      data: conversationCheck,
      conversationId: conversation_id,
      userId: userId
    });

    if (conversationError) {
      console.error('Database error checking conversation:', conversationError);
      return res.status(400).json(errorResponse('Database error: ' + conversationError.message, 'DATABASE_ERROR'));
    }

    if (!conversationCheck) {
      console.error('Conversation not found in database:', {
        conversationId: conversation_id,
        userId: userId
      });
      return res.status(404).json(errorResponse('Conversation not found', 'CONVERSATION_NOT_FOUND'));
    }

    // Check access permissions
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const canAccess = userProfile?.role === 'admin' || 
                     conversationCheck.driver_id === userId || 
                     conversationCheck.client_id === userId;

    if (!canAccess) {
      return res.status(403).json(errorResponse('Access denied to this conversation', 'ACCESS_DENIED'));
    }

    // Check if conversation is still active (for non-admin users)
    if (userProfile?.role !== 'admin' && 
        !conversationCheck.is_active && 
        conversationCheck.expires_at && 
        new Date(conversationCheck.expires_at) <= new Date()) {
      return res.status(400).json(errorResponse('This conversation has expired', 'CONVERSATION_EXPIRED'));
    }

    // Insert the message directly
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation_id,
        sender_id: userId,
        content: content.trim(),
        message_type: message_type,
        delivered_at: new Date().toISOString()
      })
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        message_type,
        sent_at,
        delivered_at,
        read_at,
        created_at,
        sender:profiles!sender_id(
          id,
          first_name,
          last_name,
          avatar_url,
          role
        )
      `)
      .single();

    if (error) {
      console.error('Database error sending message:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    console.log('✅ Message sent successfully:', data);
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
  console.log('📥 Get Conversation Messages Request:', {
    user: req.user?.id,
    params: req.params,
    query: req.query
  });

  const { conversationId } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('User not authenticated', 'UNAUTHORIZED'));
  }

  if (!conversationId) {
    return res.status(400).json(errorResponse('Conversation ID is required', 'MISSING_CONVERSATION_ID'));
  }

  try {
    // First check if user can access this conversation
    const { data: conversationCheck, error: conversationError } = await supabase
      .from('conversations')
      .select(`
        id,
        is_active,
        expires_at,
        driver_id,
        client_id,
        shipment_id
      `)
      .eq('id', conversationId)
      .single();

    if (conversationError || !conversationCheck) {
      console.error('Conversation not found:', conversationError);
      return res.status(404).json(errorResponse('Conversation not found', 'CONVERSATION_NOT_FOUND'));
    }

    // Check access permissions
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const canAccess = userProfile?.role === 'admin' || 
                     conversationCheck.driver_id === userId || 
                     conversationCheck.client_id === userId;

    if (!canAccess) {
      return res.status(403).json(errorResponse('Access denied to this conversation', 'ACCESS_DENIED'));
    }

    // Get messages directly
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        message_type,
        sent_at,
        delivered_at,
        read_at,
        created_at,
        sender:profiles!sender_id(
          id,
          first_name,
          last_name,
          avatar_url,
          role
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(parseInt(offset as string, 10), parseInt(offset as string, 10) + parseInt(limit as string, 10) - 1);

    if (error) {
      console.error('Database error fetching messages:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    console.log(`✅ Retrieved ${data?.length || 0} messages`);
    return res.status(200).json(successResponse(data, 'Messages retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return res.status(500).json(errorResponse('Failed to fetch messages', 'FETCH_MESSAGES_FAILED'));
  }
});

/**
 * Get user's conversations
 */
export const getUserConversations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('📋 Get User Conversations Request:', {
    user: req.user?.id
  });

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('User not authenticated', 'UNAUTHORIZED'));
  }

  try {
    const { data, error } = await supabase.rpc('get_user_conversations_v2', {
      p_user_id: userId
    });

    if (error) {
      console.error('Database error fetching conversations:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    console.log('📋 Detailed conversation data:', JSON.stringify(data, null, 2));
    console.log(`✅ Retrieved ${data?.length || 0} conversations`);
    return res.status(200).json(successResponse(data, 'Conversations retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return res.status(500).json(errorResponse('Failed to fetch conversations', 'FETCH_CONVERSATIONS_FAILED'));
  }
});

/**
 * Mark message as read
 */
export const markMessageAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('👁️ Mark Message as Read Request:', {
    user: req.user?.id,
    params: req.params
  });

  const { messageId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('User not authenticated', 'UNAUTHORIZED'));
  }

  if (!messageId) {
    return res.status(400).json(errorResponse('Message ID is required', 'MISSING_MESSAGE_ID'));
  }

  try {
    // First verify the message exists and user can access it
    const { data: messageCheck, error: messageError } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        conversations!inner(
          driver_id,
          client_id
        )
      `)
      .eq('id', messageId)
      .single();

    if (messageError || !messageCheck) {
      console.error('Message not found:', messageError);
      return res.status(404).json(errorResponse('Message not found', 'MESSAGE_NOT_FOUND'));
    }

    // Check if user can access this message (either part of conversation or admin)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const canAccess = userProfile?.role === 'admin' || 
                     messageCheck.conversations.driver_id === userId || 
                     messageCheck.conversations.client_id === userId;

    if (!canAccess) {
      return res.status(403).json(errorResponse('Access denied to this message', 'ACCESS_DENIED'));
    }

    // Update the message as read
    const { data, error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .select('read_at')
      .single();

    if (error) {
      console.error('Database error marking message as read:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    console.log('✅ Message marked as read:', data);
    return res.status(200).json(successResponse({ read: !!data.read_at }, 'Message marked as read'));
  } catch (error: any) {
    console.error('Error marking message as read:', error);
    return res.status(500).json(errorResponse('Failed to mark message as read', 'MARK_READ_FAILED'));
  }
});

/**
 * Get conversation by shipment ID
 */
export const getConversationByShipment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🚢 Get Conversation by Shipment Request:', {
    user: req.user?.id,
    params: req.params
  });

  const { shipmentId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('User not authenticated', 'UNAUTHORIZED'));
  }

  if (!shipmentId) {
    return res.status(400).json(errorResponse('Shipment ID is required', 'MISSING_SHIPMENT_ID'));
  }

  try {
    const { data, error } = await supabase.rpc('get_conversation_by_shipment', {
      p_shipment_id: shipmentId
    });

    if (error) {
      console.error('Database error fetching conversation:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    console.log('✅ Conversation retrieved:', data);
    return res.status(200).json(successResponse(data, 'Conversation retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    return res.status(500).json(errorResponse('Failed to fetch conversation', 'FETCH_CONVERSATION_FAILED'));
  }
});

/**
 * Admin endpoint - Create conversation manually (for admin use)
 */
export const createConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔧 Admin Create Conversation Request:', {
    user: req.user?.id,
    body: req.body
  });

  const { shipment_id, client_id, driver_id } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    return res.status(401).json(errorResponse('User not authenticated', 'UNAUTHORIZED'));
  }

  if (userRole !== 'admin') {
    return res.status(403).json(errorResponse('Admin access required', 'ADMIN_REQUIRED'));
  }

  if (!shipment_id || !client_id || !driver_id) {
    return res.status(400).json(errorResponse('Shipment ID, client ID, and driver ID are required', 'MISSING_PARAMETERS'));
  }

  try {
    // Create conversation directly (admin bypass)
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        shipment_id,
        client_id,
        driver_id
      })
      .select('*')
      .single();

    if (error) {
      console.error('Database error creating conversation:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    console.log('✅ Conversation created by admin:', data);
    return res.status(201).json(successResponse(data, 'Conversation created successfully'));
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return res.status(500).json(errorResponse('Failed to create conversation', 'CREATE_CONVERSATION_FAILED'));
  }
});

/**
 * Get messaging status for a conversation
 */
export const getMessagingStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('📊 Get Messaging Status Request:', {
    user: req.user?.id,
    params: req.params
  });

  const { conversationId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json(errorResponse('User not authenticated', 'UNAUTHORIZED'));
  }

  if (!conversationId) {
    return res.status(400).json(errorResponse('Conversation ID is required', 'MISSING_CONVERSATION_ID'));
  }

  try {
    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        shipment:shipments(
          id,
          status,
          title,
          client_id,
          driver_id
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json(errorResponse('Conversation not found', 'CONVERSATION_NOT_FOUND'));
    }

    // Check if user can access
    const { data: canAccess } = await supabase.rpc('can_access_conversation', {
      p_conversation_id: conversationId,
      p_user_id: userId
    });

    const status = {
      conversation_id: conversationId,
      is_active: conversation.is_active,
      can_access: canAccess,
      expires_at: conversation.expires_at,
      shipment_status: conversation.shipment?.status,
      participants: {
        client_id: conversation.client_id,
        driver_id: conversation.driver_id
      }
    };

    console.log('✅ Messaging status retrieved:', status);
    return res.status(200).json(successResponse(status, 'Messaging status retrieved'));
  } catch (error: any) {
    console.error('Error getting messaging status:', error);
    return res.status(500).json(errorResponse('Failed to get messaging status', 'GET_STATUS_FAILED'));
  }
});

/**
 * Cleanup expired conversations (admin only)
 */
export const cleanupExpiredConversations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🧹 Cleanup Expired Conversations Request:', {
    user: req.user?.id
  });

  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    return res.status(401).json(errorResponse('User not authenticated', 'UNAUTHORIZED'));
  }

  if (userRole !== 'admin') {
    return res.status(403).json(errorResponse('Admin access required', 'ADMIN_REQUIRED'));
  }

  try {
    const { data, error } = await supabase.rpc('cleanup_expired_conversations');

    if (error) {
      console.error('Database error cleaning up conversations:', error);
      return res.status(400).json(errorResponse(error.message, 'DATABASE_ERROR'));
    }

    console.log('✅ Cleaned up expired conversations:', data);
    return res.status(200).json(successResponse({ deleted_count: data }, 'Expired conversations cleaned up'));
  } catch (error: any) {
    console.error('Error cleaning up conversations:', error);
    return res.status(500).json(errorResponse('Failed to cleanup conversations', 'CLEANUP_FAILED'));
  }
});