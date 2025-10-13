# Messaging System Documentation

## Overview
DriveDrop uses a real-time messaging system built on **Supabase Realtime** with role-based access control and automatic expiry for completed shipments.

## Architecture

### Backend (`backend/src/`)
- **Controller**: `controllers/messages.controller.ts` - Handles HTTP endpoints
- **Routes**: `routes/messages.routes.ts` - Defines API routes
- **Database**: PostgreSQL with RLS policies (see `supabase/migrations/02_row_level_security.sql`)

### Mobile (`mobile/src/`)
- **Screens**: 
  - `screens/home/MessagesScreen.tsx` - Client messaging interface
  - `screens/driver/MessagesScreen.tsx` - Driver messaging interface
- **Hooks**: `hooks/useRealtimeMessages.ts` - Real-time message subscriptions
- **Services**: `services/RealtimeService.ts` - Supabase realtime connection management

## Features

### ✅ Real-time Message Delivery
- Messages appear instantly using Supabase Realtime subscriptions
- No polling required - push-based updates
- Connection status indicator (online/offline)

### ✅ Role-Based Access Control
- **Clients** can message drivers assigned to their shipments
- **Drivers** can message clients for their assigned shipments
- **Admins** can message anyone
- RLS policies enforce access at database level

### ✅ Message Expiry
- Conversations expire **24 hours after delivery**
- Prevents messaging after shipment completion
- Backend validates expiry before allowing messages

### ✅ Read Status Tracking
- Messages show read/unread status
- Automatic marking as read when viewed
- Unread count badges on conversations

### ✅ Responsive Design
- Tablet view: Split screen (contacts | messages)
- Mobile view: Full screen with modal for contacts
- Optimized for both form factors

## API Endpoints

### POST `/api/v1/messages/send`
Send a message in a shipment conversation.

**Request:**
```json
{
  "shipment_id": "uuid",
  "content": "Message text",
  "receiver_id": "uuid (optional)",
  "message_type": "text"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "id": "uuid",
    "shipment_id": "uuid",
    "sender_id": "uuid",
    "content": "Message text",
    "created_at": "2025-10-14T00:00:00Z",
    "is_read": false
  }
}
```

### GET `/api/v1/messages/conversation/:shipmentId`
Get all messages for a specific shipment.

**Query Params:**
- `limit` (optional): Number of messages (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "shipment_id": "uuid",
      "sender_id": "uuid",
      "receiver_id": "uuid",
      "content": "Message text",
      "created_at": "2025-10-14T00:00:00Z",
      "is_read": false,
      "sender": {
        "id": "uuid",
        "first_name": "John",
        "last_name": "Doe",
        "role": "client"
      }
    }
  ]
}
```

### GET `/api/v1/messages/conversations`
Get all conversations for the current user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "shipment_id": "uuid",
      "other_participant": {
        "id": "uuid",
        "first_name": "Jane",
        "last_name": "Smith",
        "role": "driver"
      },
      "last_message": {
        "content": "Last message text",
        "created_at": "2025-10-14T00:00:00Z"
      },
      "unread_count": 3,
      "messaging_allowed": true,
      "expires_at": "2025-10-15T00:00:00Z"
    }
  ]
}
```

### PUT `/api/v1/messages/:messageId/read`
Mark a message as read.

**Response:**
```json
{
  "success": true,
  "message": "Message marked as read",
  "data": {
    "id": "uuid",
    "is_read": true
  }
}
```

### GET `/api/v1/messages/status/:shipmentId`
Check if messaging is allowed for a shipment.

**Response:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "reason": "active",
    "expires_at": "2025-10-15T00:00:00Z",
    "shipment_status": "in_transit"
  }
}
```

## Database Schema

### messages table
```sql
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id uuid NOT NULL REFERENCES shipments(id),
  sender_id uuid NOT NULL REFERENCES profiles(id),
  receiver_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
```

### message_read_status table
```sql
CREATE TABLE public.message_read_status (
  id bigint PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES messages(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
```

## RLS Policies

### View Messages
- Users can view messages where they are the client or driver of the shipment
- Admins can view all messages

```sql
CREATE POLICY "Shipment participants can view messages" 
ON messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE shipments.id = messages.shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    )
);
```

### Send Messages
- Users can send messages if they are participants in the shipment
- Must be the sender_id (prevents impersonation)

```sql
CREATE POLICY "Shipment participants can send messages" 
ON messages FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE shipments.id = messages.shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    ) AND
    auth.uid() = sender_id
);
```

## Usage Examples

### Mobile - Using useRealtimeMessages Hook

```tsx
import { useRealtimeMessages } from '../hooks/useRealtimeMessages';
import { useAuth } from '../hooks/useAuth';

function ConversationScreen({ route }) {
  const { shipmentId } = route.params;
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  
  // Hook automatically subscribes to real-time updates
  const { 
    messages, 
    loading, 
    error, 
    sendMessage, 
    markAsRead 
  } = useRealtimeMessages(shipmentId);
  
  const handleSend = async () => {
    if (messageText.trim() && user?.id) {
      const success = await sendMessage(messageText, user.id);
      if (success) {
        setMessageText('');
      }
    }
  };
  
  return (
    <View>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <MessageBubble 
            message={item} 
            isOwnMessage={item.sender_id === user?.id}
            onPress={() => markAsRead(item.id)}
          />
        )}
      />
      <TextInput
        value={messageText}
        onChangeText={setMessageText}
        placeholder="Type a message..."
      />
      <Button title="Send" onPress={handleSend} />
    </View>
  );
}
```

### Backend - Sending Message via API

```typescript
import { supabase } from '../lib/supabase';

// Using the database function (recommended)
const { data, error } = await supabase.rpc('send_message_v2', {
  p_shipment_id: shipmentId,
  p_content: messageText,
  p_receiver_id: receiverId,
  p_message_type: 'text'
});

// Or direct insert (requires authentication)
const { data, error } = await supabase
  .from('messages')
  .insert({
    shipment_id: shipmentId,
    sender_id: userId,
    receiver_id: receiverId,
    content: messageText,
  })
  .select()
  .single();
```

## Performance Optimizations

### 1. Real-time Subscriptions
- Single subscription per shipment (not per message)
- Automatic reconnection on network changes
- Graceful degradation if real-time fails

### 2. Message Pagination
- Load 50 messages initially
- Load more on scroll
- Optimized queries with indexes

### 3. Read Status Optimization
- Batch mark-as-read operations
- Debounced updates (avoid spamming server)
- Local optimistic updates

### 4. Connection Management
- Automatic cleanup on unmount
- Shared connection across app
- Connection pooling via RealtimeService

## Security Best Practices

### ✅ Implemented
- All endpoints require authentication
- RLS policies enforce access control
- Message content validation (max 2000 chars)
- SQL injection prevention (parameterized queries)
- XSS prevention (text content only, no HTML)

### ✅ Message Expiry
- 24-hour window after delivery
- Backend validates before allowing send
- UI shows expiry status

### ✅ Rate Limiting
- Backend can add rate limiting per user
- Prevents spam and abuse

## Troubleshooting

### Messages not appearing in real-time
1. Check connection status indicator (should be green "Online")
2. Verify Supabase Realtime is enabled in project settings
3. Check network connectivity
4. Verify RLS policies allow access

### "Messaging Unavailable" error
- Shipment status must be active (pending, accepted, in_transit, delivered)
- If delivered, must be within 24 hours
- Driver must be assigned to shipment
- Check `/api/v1/messages/status/:shipmentId` endpoint

### Messages sending but not saving
- Check backend logs for RLS policy violations
- Verify user has correct role (client/driver)
- Verify shipment assignment is correct

### High battery drain
- Ensure subscriptions are cleaned up on unmount
- Check for multiple subscription instances
- Verify RealtimeService is singleton

## Future Enhancements (Optional)

### 🔮 Potential Features
- [ ] Image/file attachments
- [ ] Voice messages
- [ ] Message reactions (👍, ❤️, etc.)
- [ ] Typing indicators
- [ ] Message search
- [ ] Message deletion/editing
- [ ] Push notifications for new messages
- [ ] Desktop notifications (web)
- [ ] Message encryption (end-to-end)
- [ ] Group conversations (multi-party)

### 🔮 Performance Improvements
- [ ] Message caching (local storage)
- [ ] Offline message queue
- [ ] WebSocket fallback for real-time
- [ ] Message compression
- [ ] CDN for media attachments

## Maintenance

### Regular Tasks
- [ ] Monitor database size (`messages` table)
- [ ] Archive old messages (>90 days)
- [ ] Review RLS policies quarterly
- [ ] Update Supabase SDK versions
- [ ] Test real-time functionality after updates

### Monitoring Metrics
- Message delivery time (target: <500ms)
- Real-time connection uptime (target: >99%)
- Failed message rate (target: <0.1%)
- Average conversation length
- Unread message accumulation

## Support

For issues or questions:
1. Check this documentation
2. Review backend logs (`backend/src/controllers/messages.controller.ts`)
3. Check Supabase dashboard for real-time activity
4. Review RLS policies in database

---

**Last Updated**: October 14, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
