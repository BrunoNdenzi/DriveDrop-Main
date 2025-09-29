# NEW MESSAGING SYSTEM V2 - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the completely redesigned messaging system that maintains design and functionality while improving the architecture.

## Key Features

✅ **Driver Assignment Trigger**: Conversations are automatically created when a driver is assigned to a shipment
✅ **Conversation Lifecycle**: Conversations are active during shipments and expire 24 hours after completion
✅ **Message Status Tracking**: Sent, delivered, and read indicators for all messages
✅ **Admin Access**: Admins can message anyone in the system
✅ **Privacy Protection**: Conversations disappear after expiration to protect client privacy
✅ **Real-time Updates**: Live message delivery and status updates
✅ **Enhanced UI**: Modern, intuitive interface with proper message grouping

## Implementation Steps

### 1. Database Migration

Run the new database schema:

```sql
-- Apply the new messaging system schema
\i sql/messaging_system_v2.sql
```

This will:
- Drop old messaging tables and functions
- Create new `conversations` and `messages` tables
- Set up triggers for automatic conversation creation/expiration
- Create new functions for messaging operations
- Apply proper RLS policies

### 2. Backend API Deployment

The new backend controller and routes are ready:

- `backend/src/controllers/messages_v2.controller.ts`
- `backend/src/routes/messages_v2.routes.ts`

Routes available at `/api/v1/messages-v2/`:
- `POST /send` - Send message
- `GET /conversation/:conversationId` - Get conversation messages
- `GET /conversations` - Get user conversations
- `PUT /:messageId/read` - Mark message as read
- `GET /shipment/:shipmentId/conversation` - Get conversation by shipment
- `GET /conversation/:conversationId/status` - Get messaging status
- `POST /admin/conversation` - Admin create conversation
- `POST /admin/cleanup` - Admin cleanup expired conversations

### 3. Mobile App Integration

New components ready for use:

#### Core Service
- `mobile/src/services/MessagingServiceV2.ts` - Complete messaging service

#### Hook
- `mobile/src/hooks/useMessagingV2.ts` - React hook for messaging functionality

#### Types
- `mobile/src/types/MessagingTypes.ts` - TypeScript type definitions

#### UI Component
- `mobile/src/screens/messaging/MessagingScreenV2.tsx` - New messaging interface

#### Navigation
- Added to both client and driver tab navigators
- Available as `MessagesV2` tab and `MessagingV2` screen

### 4. Testing the New System

#### Test Conversation Creation
1. Create a shipment as a client
2. Assign a driver to the shipment (admin action)
3. Verify conversation appears in both client and driver messaging tabs
4. Check that system message about assignment is sent

#### Test Messaging Flow
1. Client sends message to driver
2. Verify message appears with "sent" status
3. Driver receives message in real-time
4. Message status updates to "delivered"
5. Driver reads message
6. Message status updates to "read" with checkmarks

#### Test Conversation Expiration
1. Mark shipment as "delivered"
2. Verify system message about 24-hour expiration
3. Wait 24 hours (or manually update expires_at for testing)
4. Verify conversation disappears from both users

#### Test Admin Features
1. Admin can see all conversations
2. Admin can message anyone
3. Admin can manually create conversations
4. Admin can cleanup expired conversations

### 5. Migration Strategy

#### Gradual Migration Approach:

1. **Phase 1**: Deploy new system alongside old system
   - New users get V2 automatically
   - Old users continue with V1
   - Monitor V2 performance

2. **Phase 2**: Migrate existing users
   - Export important conversation data
   - Create new conversations for active shipments
   - Notify users about the upgrade

3. **Phase 3**: Remove old system
   - Disable old messaging routes
   - Clean up old database tables
   - Update all navigation to use V2

#### Immediate Switch Approach:

1. Deploy all components simultaneously
2. Update navigation to use `MessagingScreenV2` directly
3. Remove old messaging components

### 6. Configuration

#### Environment Variables
Make sure these are set in your backend:

```env
EXPO_PUBLIC_API_BASE_URL=your_backend_url
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Database Functions
The system uses these new database functions:
- `send_message_v2()`
- `get_conversation_messages_v2()`
- `get_user_conversations_v2()`
- `mark_message_as_read_v2()`
- `get_conversation_by_shipment()`
- `can_access_conversation()`

### 7. Monitoring and Maintenance

#### Key Metrics to Monitor:
- Conversation creation rate
- Message delivery success rate
- Real-time connection stability
- Conversation expiration cleanup

#### Regular Maintenance:
- Run cleanup function daily to remove expired conversations
- Monitor database performance with message volume
- Check real-time subscription health

#### Logging:
The system includes comprehensive logging for:
- Message sending/receiving
- Conversation lifecycle events
- Real-time connection status
- Error handling

## API Usage Examples

### Send a Message
```typescript
const response = await MessagingService.sendMessage({
  conversation_id: 'uuid-here',
  content: 'Hello, how is the delivery going?',
  message_type: 'text'
});
```

### Get Conversations
```typescript
const conversations = await MessagingService.getUserConversations();
```

### Get Messages for Conversation
```typescript
const messages = await MessagingService.getConversationMessages(
  conversationId, 
  50, // limit
  0   // offset
);
```

### Subscribe to Real-time Updates
```typescript
const channel = MessagingService.subscribeToConversation(
  conversationId,
  (newMessage) => console.log('New message:', newMessage),
  (updatedMessage) => console.log('Message updated:', updatedMessage),
  (error) => console.error('Error:', error)
);
```

## UI Navigation Examples

### Navigate to Messages List
```typescript
navigation.navigate('MessagingV2', { mode: 'list' });
```

### Navigate to Specific Conversation
```typescript
navigation.navigate('MessagingV2', { 
  conversationId: 'uuid-here',
  mode: 'conversation' 
});
```

### Navigate from Shipment to Messages
```typescript
navigation.navigate('MessagingV2', { 
  shipmentId: 'shipment-uuid-here' 
});
```

## Troubleshooting

### Common Issues:

1. **Messages not appearing in real-time**
   - Check Supabase real-time subscription status
   - Verify RLS policies are correct
   - Check network connectivity

2. **Conversation not created when driver assigned**
   - Verify triggers are installed correctly
   - Check that shipment status change is detected
   - Ensure driver_id is properly set

3. **Messages showing wrong status**
   - Check database timestamp functions
   - Verify message update triggers
   - Check client-side state management

4. **Admin can't see all conversations**
   - Verify admin role in profile
   - Check RLS policies for admin access
   - Ensure database functions handle admin logic

### Performance Optimization:

1. **Message Loading**
   - Implement pagination for large conversations
   - Use message offsets for efficient loading
   - Consider message archiving for very old conversations

2. **Real-time Connections**
   - Limit number of active subscriptions
   - Implement connection pooling
   - Use reconnection logic for network issues

3. **Database Performance**
   - Regular VACUUM on messages table
   - Monitor index usage
   - Consider partitioning for large message volumes

## Success Criteria

The implementation is successful when:

✅ Conversations are automatically created when drivers are assigned
✅ Messages are delivered in real-time with proper status indicators
✅ Conversations expire 24 hours after shipment completion
✅ Admin users can access all conversations
✅ UI is intuitive and maintains the existing design language
✅ System handles both client and driver perspectives properly
✅ No data loss during migration
✅ Performance is acceptable under normal load

## Next Steps

After successful implementation:

1. Monitor user adoption and feedback
2. Consider additional features like:
   - Message attachments (images, documents)
   - Voice messages
   - Message reactions
   - Conversation search
   - Message forwarding
3. Optimize based on usage patterns
4. Expand admin tools for conversation management