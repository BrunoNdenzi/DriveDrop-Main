-- Quick email logs check (no errors)
-- Run this in Supabase SQL Editor

-- Check if email_logs table exists
SELECT COUNT(*) as total_emails FROM email_logs;

-- Check recent emails (last 24 hours)
SELECT 
  email_type,
  recipient_email,
  status,
  brevo_message_id,
  error_message,
  created_at
FROM email_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- Check emails to Bruno specifically
SELECT 
  email_type,
  status,
  brevo_message_id,
  error_message,
  created_at
FROM email_logs
WHERE recipient_email = 'brunondenzi80@gmail.com'
ORDER BY created_at DESC
LIMIT 10;
