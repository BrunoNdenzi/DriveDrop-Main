/**
 * Messages routes for the backend API
 */
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { 
  sendMessage,
  getConversationMessages,
  getUserConversations,
  markMessageAsRead,
  checkMessagingStatus,
  getAvailableContacts
} from '@controllers/messages.controller';

const router = Router();

/**
 * @route POST /api/v1/messages/send
 * @desc Send a message
 * @access Private
 */
router.post('/send', authenticate, sendMessage);

/**
 * @route GET /api/v1/messages/conversation/:shipmentId
 * @desc Get messages for a specific conversation/shipment
 * @access Private
 */
router.get('/conversation/:shipmentId', authenticate, getConversationMessages);

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
 */
router.put('/:messageId/read', authenticate, markMessageAsRead);

/**
 * @route GET /api/v1/messages/status/:shipmentId
 * @desc Check if messaging is allowed for a shipment
 * @access Private
 */
router.get('/status/:shipmentId', authenticate, checkMessagingStatus);

/**
 * @route GET /api/v1/messages/contacts
 * @desc Get available contacts for messaging
 * @access Private
 */
router.get('/contacts', authenticate, getAvailableContacts);

export default router;
