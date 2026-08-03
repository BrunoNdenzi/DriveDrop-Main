-- Smart Campaign Builder: Templates, AI, Field Mapping, Analytics
-- Migration extends Quick Send with Phase 1 + Phase 2 features

-- =====================================================
-- Templates Table
-- =====================================================
CREATE TABLE IF NOT EXISTS quick_send_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'logistics', 'broker_outreach', 'driver_recruitment', 'custom'
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  description TEXT,
  field_mappings JSONB DEFAULT '[]'::jsonb, -- [{fieldName: 'firstName', required: true, fallback: 'there'}]
  is_system BOOLEAN DEFAULT false, -- System templates vs user-created
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  use_count INTEGER DEFAULT 0 -- Track popularity
);

CREATE INDEX idx_quick_send_templates_category ON quick_send_templates(category);
CREATE INDEX idx_quick_send_templates_created_by ON quick_send_templates(created_by);

-- =====================================================
-- Enhanced Batches Table (add columns)
-- =====================================================
ALTER TABLE quick_send_batches 
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES quick_send_templates(id),
ADD COLUMN IF NOT EXISTS field_mappings JSONB DEFAULT '{}'::jsonb, -- {firstName: 'First Name', company: 'Company'}
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual', -- 'manual', 'csv', 'database'
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX idx_quick_send_batches_template ON quick_send_batches(template_id);
CREATE INDEX idx_quick_send_batches_scheduled ON quick_send_batches(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_quick_send_batches_tags ON quick_send_batches USING GIN(tags);

-- =====================================================
-- Enhanced Recipients Table (add custom fields)
-- =====================================================
ALTER TABLE quick_send_recipients
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb, -- {firstName: 'John', company: 'ACME Corp', truckCount: '50'}
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

CREATE INDEX idx_quick_send_recipients_custom_fields ON quick_send_recipients USING GIN(custom_fields);
CREATE INDEX idx_quick_send_recipients_opened ON quick_send_recipients(opened_at) WHERE opened_at IS NOT NULL;

-- =====================================================
-- Upload History (track file imports)
-- =====================================================
CREATE TABLE IF NOT EXISTS quick_send_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES quick_send_batches(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  row_count INTEGER NOT NULL,
  valid_count INTEGER NOT NULL,
  invalid_count INTEGER NOT NULL,
  field_mappings JSONB NOT NULL, -- Column mappings from CSV
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quick_send_uploads_batch ON quick_send_uploads(batch_id);
CREATE INDEX idx_quick_send_uploads_uploaded_by ON quick_send_uploads(uploaded_by);

-- =====================================================
-- AI Generation History (track AI usage)
-- =====================================================
CREATE TABLE IF NOT EXISTS quick_send_ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES quick_send_batches(id),
  generation_type TEXT NOT NULL, -- 'subject', 'body', 'both', 'rewrite', 'personalization'
  input_prompt TEXT NOT NULL,
  generated_content TEXT NOT NULL,
  tokens_used INTEGER,
  model TEXT DEFAULT 'gpt-4',
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quick_send_ai_generations_batch ON quick_send_ai_generations(batch_id);
CREATE INDEX idx_quick_send_ai_generations_type ON quick_send_ai_generations(generation_type);

-- =====================================================
-- Click Tracking (for link analytics)
-- =====================================================
CREATE TABLE IF NOT EXISTS quick_send_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES quick_send_recipients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_quick_send_clicks_recipient ON quick_send_clicks(recipient_id);
CREATE INDEX idx_quick_send_clicks_clicked_at ON quick_send_clicks(clicked_at);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE quick_send_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_send_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_send_ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_send_clicks ENABLE ROW LEVEL SECURITY;

-- Admin-only access for all new tables
CREATE POLICY quick_send_templates_admin_all ON quick_send_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

CREATE POLICY quick_send_uploads_admin_all ON quick_send_uploads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

CREATE POLICY quick_send_ai_generations_admin_all ON quick_send_ai_generations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

CREATE POLICY quick_send_clicks_admin_all ON quick_send_clicks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

-- =====================================================
-- Default System Templates
-- =====================================================
INSERT INTO quick_send_templates (name, category, subject, message, description, is_system, field_mappings) VALUES
(
  'Broker Partnership Outreach',
  'broker_outreach',
  'Reliable Freight Partner in {{customField:location}}',
  'Dear {{firstName}},

I hope this message finds you well. My name is {{senderName}} from DriveDrop.

We specialize in providing reliable freight solutions for brokers like {{company}}. With our fleet of {{customField:truckCount}} trucks and coverage across {{customField:serviceArea}}, we''re positioned to be your go-to carrier partner.

What sets us apart:
✓ 99% on-time delivery rate
✓ Real-time tracking and updates
✓ Competitive rates with transparent pricing
✓ Dedicated support team

I''d love to discuss how we can support your freight needs. Are you available for a brief call this week?

Best regards,
{{senderName}}
DriveDrop Team',
  'Professional broker partnership introduction with personalization',
  true,
  '[
    {"fieldName": "firstName", "label": "First Name", "required": false, "fallback": "there"},
    {"fieldName": "company", "label": "Company Name", "required": false, "fallback": "your company"},
    {"fieldName": "location", "label": "Location", "required": false, "fallback": "your area"},
    {"fieldName": "senderName", "label": "Sender Name", "required": true, "fallback": "the DriveDrop Team"}
  ]'::jsonb
),
(
  'Driver Recruitment',
  'driver_recruitment',
  'CDL Driving Opportunities - Competitive Pay & Benefits',
  'Hi {{firstName}},

Are you looking for a driving opportunity that values your experience and offers great compensation?

DriveDrop is hiring experienced CDL-A drivers for {{customField:routeType}} routes. Here''s what we offer:

💰 Competitive Pay: {{customField:payRange}}/mile
🏠 Home Time: {{customField:homeTime}}
✅ Benefits: Health insurance, 401(k), paid time off
🚛 Equipment: Late-model trucks with APU
📱 Technology: Easy load tracking and communication

Requirements:
- Valid CDL-A license
- {{customField:minExperience}} of OTR experience
- Clean MVR

Interested? Reply to this email or call us at {{customField:phoneNumber}}.

Drive with the best!
{{senderName}}',
  'Driver recruitment with compensation and benefits details',
  true,
  '[
    {"fieldName": "firstName", "label": "First Name", "required": false, "fallback": "Driver"},
    {"fieldName": "senderName", "label": "Recruiter Name", "required": true, "fallback": "DriveDrop Recruiting"}
  ]'::jsonb
),
(
  'Logistics Update',
  'logistics',
  '{{customField:updateType}} - {{company}}',
  'Hello {{firstName}},

{{customField:mainMessage}}

{{customField:callToAction}}

If you have any questions, please don''t hesitate to reach out.

Best regards,
{{senderName}}
DriveDrop',
  'General logistics update template with flexible content',
  true,
  '[
    {"fieldName": "firstName", "label": "First Name", "required": false, "fallback": "there"},
    {"fieldName": "company", "label": "Company Name", "required": false, "fallback": "Valued Partner"},
    {"fieldName": "senderName", "label": "Sender Name", "required": true, "fallback": "the DriveDrop Team"}
  ]'::jsonb
);

-- =====================================================
-- Analytics Views
-- =====================================================
CREATE OR REPLACE VIEW quick_send_batch_analytics AS
SELECT 
  b.id,
  b.category,
  b.subject,
  b.created_at,
  b.total_count,
  b.sent_count,
  b.failed_count,
  b.suppressed_count,
  COALESCE(SUM(CASE WHEN r.opened_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS open_count,
  COALESCE(SUM(r.open_count), 0) AS total_opens,
  COALESCE(SUM(CASE WHEN r.clicked_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS click_count,
  COALESCE(SUM(r.click_count), 0) AS total_clicks,
  CASE 
    WHEN b.sent_count > 0 THEN 
      ROUND((SUM(CASE WHEN r.opened_at IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC / b.sent_count * 100), 2)
    ELSE 0 
  END AS open_rate,
  CASE 
    WHEN b.sent_count > 0 THEN 
      ROUND((SUM(CASE WHEN r.clicked_at IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC / b.sent_count * 100), 2)
    ELSE 0 
  END AS click_rate
FROM quick_send_batches b
LEFT JOIN quick_send_recipients r ON r.batch_id = b.id
GROUP BY b.id, b.category, b.subject, b.created_at, b.total_count, b.sent_count, b.failed_count, b.suppressed_count;

COMMENT ON VIEW quick_send_batch_analytics IS 'Aggregated campaign performance metrics';
