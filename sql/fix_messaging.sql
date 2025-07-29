-- Fix for messaging system issues

-- First, check if the messages table exists and has the right structure
DO $$
BEGIN
  -- Create messages table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'messages' AND schemaname = 'public') THEN
    CREATE TABLE messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID NOT NULL,
      receiver_id UUID NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      read_at TIMESTAMPTZ,
      related_shipment_id UUID
    );
    
    CREATE INDEX messages_sender_id_idx ON messages(sender_id);
    CREATE INDEX messages_receiver_id_idx ON messages(receiver_id);
    CREATE INDEX messages_related_shipment_id_idx ON messages(related_shipment_id);
  ELSE
    -- Check if receiver_id column exists and add it if not
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'messages' 
      AND column_name = 'receiver_id'
    ) THEN
      ALTER TABLE messages ADD COLUMN receiver_id UUID;
      CREATE INDEX messages_receiver_id_idx ON messages(receiver_id);
    END IF;
  END IF;
END $$;

-- Create function to send a message
CREATE OR REPLACE FUNCTION send_message(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_content TEXT,
  p_related_shipment_id UUID DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  new_message_id UUID;
  result jsonb;
BEGIN
  INSERT INTO messages (
    sender_id,
    receiver_id,
    content,
    related_shipment_id
  ) 
  VALUES (
    p_sender_id,
    p_receiver_id,
    p_content,
    p_related_shipment_id
  )
  RETURNING id INTO new_message_id;
  
  -- Get the full message object
  SELECT jsonb_build_object(
    'id', m.id,
    'sender_id', m.sender_id,
    'sender', jsonb_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'avatar_url', s.avatar_url
    ),
    'receiver_id', m.receiver_id,
    'receiver', jsonb_build_object(
      'id', r.id,
      'first_name', r.first_name,
      'last_name', r.last_name,
      'avatar_url', r.avatar_url
    ),
    'content', m.content,
    'created_at', m.created_at,
    'read_at', m.read_at,
    'related_shipment_id', m.related_shipment_id
  ) INTO result
  FROM messages m
  JOIN profiles s ON m.sender_id = s.id
  JOIN profiles r ON m.receiver_id = r.id
  WHERE m.id = new_message_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get messages between two users
CREATE OR REPLACE FUNCTION get_messages_between_users(
  p_user1_id UUID,
  p_user2_id UUID,
  p_limit INT DEFAULT 50
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'sender_id', m.sender_id,
      'receiver_id', m.receiver_id,
      'content', m.content,
      'created_at', m.created_at,
      'read_at', m.read_at,
      'related_shipment_id', m.related_shipment_id
    )
    ORDER BY m.created_at DESC
  ) INTO result
  FROM messages m
  WHERE 
    (m.sender_id = p_user1_id AND m.receiver_id = p_user2_id) OR
    (m.sender_id = p_user2_id AND m.receiver_id = p_user1_id)
  LIMIT p_limit;
  
  -- Mark messages as read
  UPDATE messages
  SET read_at = now()
  WHERE 
    receiver_id = p_user1_id AND 
    sender_id = p_user2_id AND
    read_at IS NULL;
    
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
