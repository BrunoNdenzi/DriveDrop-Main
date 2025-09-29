/**
 * NEW MESSAGING SYSTEM V2 - Routes
 * Complete re-implementation from scratch
 */
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { 
  sendMessage,
  getConversationMessages,
  getUserConversations,
  markMessageAsRead,
  getConversationByShipment,
  createConversation,
  getMessagingStatus,
  cleanupExpiredConversations
} from '../controllers/messages_v2.controller';

const router = Router();

/**
 * @route POST /api/v1/messages/send
 * @desc Send a message in a conversation
 * @access Private
 * @body { conversation_id: UUID, content: string, message_type?: string }
 */
router.post('/send', authenticate, sendMessage);

/**
 * @route GET /api/v1/messages/conversation/:conversationId
 * @desc Get messages for a specific conversation
 * @access Private
 * @params conversationId: UUID
 * @query limit?: number, offset?: number
 */
router.get('/conversation/:conversationId', authenticate, getConversationMessages);

/**
 * @route GET /api/v1/messages/conversations
 * @desc Get all conversations for the current user
 * @access Private
 */
router.get('/conversations', authenticate, getUserConversations);

/**
 * @route PUT /api/v1/messages/:messageId/read
 * @desc Mark a message as read
 * @access Private
 * @params messageId: UUID
 */
router.put('/:messageId/read', authenticate, markMessageAsRead);

/**
 * @route GET /api/v1/messages/shipment/:shipmentId/conversation
 * @desc Get conversation by shipment ID
 * @access Private
 * @params shipmentId: UUID
 */
router.get('/shipment/:shipmentId/conversation', authenticate, getConversationByShipment);

/**
 * @route GET /api/v1/messages/conversation/:conversationId/status
 * @desc Get messaging status for a conversation
 * @access Private
 * @params conversationId: UUID
 */
router.get('/conversation/:conversationId/status', authenticate, getMessagingStatus);

/**
 * ADMIN ROUTES
 */

/**
 * @route POST /api/v1/messages/admin/conversation
 * @desc Create a conversation manually (admin only)
 * @access Admin
 * @body { shipment_id: UUID, client_id: UUID, driver_id: UUID }
 */
router.post('/admin/conversation', authenticate, createConversation);

/**
 * @route POST /api/v1/messages/admin/cleanup
 * @desc Cleanup expired conversations (admin only)
 * @access Admin
 */
router.post('/admin/cleanup', authenticate, cleanupExpiredConversations);

export default router;