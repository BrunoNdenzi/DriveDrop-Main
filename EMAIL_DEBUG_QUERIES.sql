-- ===============================================
-- EMAIL DEBUGGING QUERIES
-- Run these in Supabase SQL Editor to diagnose email issues
-- ===============================================

-- 1. Check recent email logs (last 24 hours)
SELECT 
  id,
  email_type,
  recipient_email,
  sender_email,
  subject,
  status,
  brevo_message_id,
  error_message,
  created_at,
  metadata
FROM email_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- 2. Count emails by status (last 7 days)
SELECT 
  status,
  COUNT(*) as count,
  email_type
FROM email_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status, email_type
ORDER BY status, email_type;

-- 3. Check failed emails with error messages
SELECT 
  recipient_email,
  sender_email,
  email_type,
  error_message,
  metadata,
  created_at
FROM email_logs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 4. Check emails sent to specific recipient (Bruno's email)
SELECT 
  email_type,
  sender_email,
  subject,
  status,
  brevo_message_id,
  error_message,
  created_at
FROM email_logs
WHERE recipient_email = 'brunondenzi80@gmail.com'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check all driver welcome emails
SELECT 
  recipient_email,
  sender_email,
  status,
  brevo_message_id,
  error_message,
  created_at
FROM email_logs
WHERE email_type = 'driver_welcome'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 6. Check if email_logs table exists and has data
SELECT 
  COUNT(*) as total_logs,
  MIN(created_at) as oldest_log,
  MAX(created_at) as newest_log
FROM email_logs;

-- ===============================================
-- EXPECTED RESULTS:
-- ===============================================
-- If emails ARE being sent by Brevo:
--   - You'll see entries with status='sent' and brevo_message_id set
--   - No error_message
--
-- If emails are FAILING:
--   - You'll see entries with status='failed'
--   - error_message will contain the reason
--
-- If NO entries exist:
--   - BREVO_ENABLED might be false on Railway
--   - The email service is not being called at all
--   - There's an issue before the email service is reached
