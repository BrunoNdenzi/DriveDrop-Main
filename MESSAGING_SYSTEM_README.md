# DriveDrop Messaging System - Complete Redesign

This document outlines the completely redesigned messaging system for DriveDrop, built from scratch to provide reliable real-time communication with proper role-based access control.

## 🚀 Features

### Core Functionality
- **Real-time messaging** with instant delivery
- **Role-based permissions** (drivers, clients, admins)
- **24-hour expiry** for completed shipments
- **Admin override** - admins can message anyone anytime
- **Automatic cleanup** of expired messages
- **Message validation** and security

### Business Rules
1. **Drivers** can only message clients from shipments assigned to them
2. **Clients** can only message drivers from their active shipments
3. **Admins** can message anyone at any time (support function)
4. **Messaging disabled** when shipment status is "pending" (no driver assigned)
5. **24-hour limit** - conversations expire 24 hours after shipment completion
6. **Active shipments only** - messaging allowed for accepted, picked_up, in_transit, and recently delivered shipments

## 📁 File Structure

### Database Layer
```
sql/
  messaging_system_redesign.sql     # Complete database schema and functions
```

### Backend API
```
backend/src/
  routes/messages.routes.ts         # API endpoints for messaging
  controllers/messages.controller.ts # Business logic for messaging API
```

### Mobile App
```
mobile/src/
  services/MessagingService.ts      # Core messaging service
  hooks/useMessaging.ts             # React hook for messaging
  types/MessageTypes.ts             # TypeScript type definitions
  screens/messaging/
    MessagingScreen.tsx             # Main messaging interface
  components/
    ConversationPicker.tsx          # Contact/conversation selection
  utils/
    MessageUtil.ts                  # Legacy compatibility layer
```

## 🔧 Setup Instructions

### 1. Database Migration

Run the SQL migration in your Supabase console:

```sql
-- Execute the contents of: sql/messaging_system_redesign.sql
-- This will create all necessary tables, functions, and permissions
```

### 2. Backend API

The messaging API is automatically available at:
- `POST /api/v1/messages/send` - Send a message
- `GET /api/v1/messages/conversation/:shipmentId` - Get conversation messages
- `GET /api/v1/messages/conversations` - Get all user conversations
- `PUT /api/v1/messages/:messageId/read` - Mark message as read
- `GET /api/v1/messages/status/:shipmentId` - Check messaging permissions
- `GET /api/v1/messages/contacts` - Get available contacts

### 3. Mobile App Usage

#### Basic Implementation
```typescript
import useMessaging from '../hooks/useMessaging';

function MyMessagingComponent({ shipmentId }) {
  const {
    messages,
    conversations,
    sendMessage,
    markAsRead,
    loading,
    error,
    connected
  } = useMessaging({ 
    shipmentId,
    autoConnect: true 
  });

  const handleSend = async (content: string) => {
    const success = await sendMessage(content);
    if (success) {
      console.log('Message sent!');
    }
  };

  return (
    <MessagingScreen 
      route={{ params: { shipmentId } }}
      navigation={navigation}
    />
  );
}
```

#### Legacy Compatibility
```typescript
import { MessageUtil } from '../utils/MessageUtil';

// Old code still works with new system
const result = await MessageUtil.sendMessage(shipmentId, senderId, content, receiverId);
```

## 🏗️ Architecture

### Database Schema

#### Messages Table
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    shipment_id UUID NOT NULL REFERENCES shipments(id),
    sender_id UUID NOT NULL REFERENCES profiles(id),
    receiver_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL CHECK (LENGTH(content) <= 2000),
    message_type VARCHAR(20) DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    metadata JSONB DEFAULT '{}'
);
```

#### Key Database Functions
- `send_message()` - Validates permissions and sends messages
- `get_conversation_messages()` - Retrieves conversation with auto-read marking
- `get_user_conversations()` - Lists all user conversations with metadata
- `is_messaging_allowed()` - Checks business rules for messaging permissions
- `mark_message_as_read()` - Updates read status
- `cleanup_expired_messages()` - Removes expired messages

### Real-time Architecture

1. **Supabase Realtime** - Database change subscriptions
2. **Channel-based** - Separate channels per conversation
3. **Auto-reconnection** - Handles connection drops gracefully
4. **Message queuing** - Handles offline scenarios
5. **Optimistic updates** - Immediate UI feedback

### Security Model

#### Row Level Security (RLS)
- Users can only view messages they sent or received
- Admins can view all messages
- Message sending validated through database functions

#### Business Logic Validation
- Shipment participation required
- Time-based restrictions enforced
- Role-based permissions checked

## 🔄 Migration from Old System

### Automatic Migration
The new system includes:
1. **Backward compatibility** - Old MessageUtil API still works
2. **Gradual adoption** - Can migrate screens one by one
3. **Data preservation** - Existing messages remain accessible

### Migration Steps
1. Run the database migration script
2. Update imports to use new MessagingScreen
3. Replace old hook calls with useMessaging
4. Test real-time functionality
5. Remove old messaging components

## 🧪 Testing

### Database Testing
```sql
-- Test messaging permissions
SELECT is_messaging_allowed('shipment-id', 'user-id');

-- Test message sending
SELECT send_message('shipment-id', 'Hello world!', 'receiver-id');

-- Test conversation retrieval
SELECT get_conversation_messages('shipment-id', 50, 0);
```

### API Testing
```bash
# Send message
curl -X POST /api/v1/messages/send \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shipment_id":"...", "content":"Hello!"}'

# Get conversations
curl -X GET /api/v1/messages/conversations \
  -H "Authorization: Bearer TOKEN"
```

### Mobile Testing
1. Test real-time message delivery
2. Verify permission restrictions
3. Test 24-hour expiry behavior
4. Check admin override functionality
5. Test offline/reconnection scenarios

## 🚨 Important Notes

### Business Rules Enforcement
- The system strictly enforces all business rules at the database level
- Frontend validations are supplementary - real security is in the database
- Admin users have special privileges for support purposes

### Performance Considerations
- Messages automatically expire after 24 hours (for completed shipments)
- Database indexes optimized for common query patterns
- Real-time subscriptions are efficiently managed
- Automatic cleanup prevents database bloat

### Error Handling
- Comprehensive error messages for validation failures
- Graceful degradation when real-time fails
- Offline support with automatic sync

## 📊 Monitoring

### Key Metrics to Monitor
- Message delivery success rate
- Real-time connection stability
- Database function performance
- Expired message cleanup efficiency
- User engagement with messaging features

### Logs to Monitor
- Database function execution logs
- Real-time subscription errors
- Message validation failures
- Permission denial events

## 🔮 Future Enhancements

### Planned Features
- Message reactions/emojis
- File/image attachments
- Message threading
- Push notification integration
- Message search functionality
- Conversation archiving

### Technical Improvements
- Message compression for large conversations
- Advanced caching strategies
- Mobile app background sync
- Message analytics dashboard

## 💡 Tips for Developers

1. **Always test permissions** - Verify users can only access appropriate conversations
2. **Monitor expiry behavior** - Ensure 24-hour rule works correctly
3. **Test real-time thoroughly** - Check connection drops and reconnections
4. **Use proper error handling** - Provide meaningful feedback to users
5. **Follow business rules** - Never bypass the permission system

## 🆘 Troubleshooting

### Common Issues

**Messages not appearing in real-time:**
- Check Supabase realtime configuration
- Verify subscription channel names
- Check network connectivity

**Permission denied errors:**
- Verify user is participant in shipment
- Check shipment status (must not be 'pending')
- Verify 24-hour rule for delivered shipments

**Database function errors:**
- Check function exists in Supabase
- Verify user permissions
- Check function parameters

### Debug Commands
```sql
-- Check user's accessible shipments
SELECT * FROM shipments WHERE client_id = 'user-id' OR driver_id = 'user-id';

-- Check message permissions
SELECT is_messaging_allowed('shipment-id', 'user-id');

-- View conversation status
SELECT get_user_conversations('user-id');
```

---

**This messaging system provides a robust, secure, and user-friendly communication platform for DriveDrop users while enforcing all business rules and maintaining excellent performance.**
