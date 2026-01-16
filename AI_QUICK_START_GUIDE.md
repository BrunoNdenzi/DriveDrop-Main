# 🚀 AI Integration - Quick Start Guide

**Last Updated:** January 16, 2026  
**For:** DriveDrop Development Team  
**Priority:** Start with Document AI (Week 1-2)

---

## 📋 **PRE-FLIGHT CHECKLIST**

Before starting AI integration, ensure you have:

- [ ] **Anthropic API Key** (Get from: https://console.anthropic.com)
- [ ] **Railway Backend Access** (Environment variables)
- [ ] **Supabase Database Access** (Run migrations)
- [ ] **Node.js 18+** installed
- [ ] **TypeScript** familiarity
- [ ] **Budget**: ~$100/month for AI APIs (scales with usage)

---

## ⚡ **OPTION 1: AI Document Auto-Fill (RECOMMENDED START)**

### **Why Start Here?**
- ✅ **Immediate Client Value**: Saves 5+ minutes per shipment
- ✅ **Clear ROI**: Reduce form abandonment by 50%
- ✅ **Foundation**: Sets up AI infrastructure for other features
- ✅ **WOW Factor**: Clients will love the magic!

### **Implementation Time: 2 Weeks**

---

## 🎯 **WEEK 1: BACKEND FOUNDATION**

### **Day 1: Setup AI Service**

#### **1. Get Anthropic API Key**
```bash
# Sign up at: https://console.anthropic.com
# Create new API key
# Copy key (starts with: sk-ant-...)
```

#### **2. Add Environment Variables**
```bash
# backend/.env (Railway)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

#### **3. Install Dependencies**
```bash
cd backend
npm install @anthropic-ai/sdk
```

#### **4. Create AI Service File**
```bash
# Create new file
touch backend/src/services/ai-document-processor.service.ts
```

Copy the `AIDocumentProcessorService` class from the roadmap document into this file.

### **Day 2-3: Database Setup**

#### **1. Add Tables**
```bash
# Create migration file
touch backend/migrations/008_ai_document_extraction.sql
```

```sql
-- backend/migrations/008_ai_document_extraction.sql

-- AI document extraction queue and results
CREATE TABLE IF NOT EXISTS ai_document_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    shipment_id UUID REFERENCES shipments(id), -- Optional
    
    -- Document info
    document_url TEXT NOT NULL,
    document_type TEXT CHECK (document_type IN (
        'registration', 'title', 'insurance', 'bill_of_sale', 
        'drivers_license', 'unknown'
    )),
    
    -- AI extraction results
    extracted_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    raw_ai_response TEXT,
    
    -- Review status
    requires_review BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Usage tracking
    used_in_shipment BOOLEAN DEFAULT FALSE,
    
    -- Performance metrics
    processing_time_ms INTEGER,
    ai_model TEXT DEFAULT 'claude-3-5-sonnet-20241022',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_extractions_user ON ai_document_extractions(user_id);
CREATE INDEX idx_ai_extractions_shipment ON ai_document_extractions(shipment_id);
CREATE INDEX idx_ai_extractions_review ON ai_document_extractions(requires_review) 
    WHERE requires_review = TRUE;

-- RLS Policies
ALTER TABLE ai_document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extractions" ON ai_document_extractions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extractions" ON ai_document_extractions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all extractions" ON ai_document_extractions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );
```

#### **2. Run Migration**
```bash
# In Supabase SQL Editor or via psql
psql -h your-db-host -U postgres -d drivedrop < backend/migrations/008_ai_document_extraction.sql
```

### **Day 4-5: API Endpoint**

#### **1. Create Route Handler**
```bash
touch backend/src/routes/ai.routes.ts
```

```typescript
// backend/src/routes/ai.routes.ts
import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { aiDocumentProcessor } from '@services/ai-document-processor.service';
import { supabaseAdmin } from '@config/supabase';

const router = Router();

/**
 * POST /api/v1/ai/extract-document
 * Extract vehicle info from document image using AI
 */
router.post(
  '/extract-document',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { imageUrl, documentType } = req.body;
    const userId = (req as any).user?.id;

    if (!imageUrl) {
      throw createError('imageUrl is required', 400, 'MISSING_FIELD');
    }

    const startTime = Date.now();

    try {
      // Process document with AI
      const result = await aiDocumentProcessor.processDocument(
        imageUrl,
        documentType
      );

      const processingTime = Date.now() - startTime;

      // Save to database
      const { data: extraction, error } = await supabaseAdmin
        .from('ai_document_extractions')
        .insert({
          user_id: userId,
          document_url: imageUrl,
          document_type: result.documentType,
          extracted_data: result.extractedData,
          confidence_score: result.confidence,
          raw_ai_response: result.rawText,
          requires_review: result.requiresReview,
          processing_time_ms: processingTime,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to save extraction:', error);
        // Don't fail the request, just log
      }

      res.status(200).json(
        successResponse({
          ...result,
          extractionId: extraction?.id,
          processingTimeMs: processingTime,
        })
      );
    } catch (error: any) {
      console.error('AI document processing error:', error);
      throw createError(
        'Failed to process document. Please try again or enter manually.',
        500,
        'AI_PROCESSING_FAILED'
      );
    }
  })
);

/**
 * GET /api/v1/ai/extractions
 * Get user's extraction history
 */
router.get(
  '/extractions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const { data, error } = await supabaseAdmin
      .from('ai_document_extractions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw createError('Failed to fetch extractions', 500, 'DB_ERROR');
    }

    res.status(200).json(successResponse(data));
  })
);

export default router;
```

#### **2. Register Route**
```typescript
// backend/src/index.ts
import aiRoutes from './routes/ai.routes';

// Add with other routes
app.use('/api/v1/ai', aiRoutes);
```

### **Day 6-7: Testing**

#### **1. Create Test Script**
```bash
touch backend/test-ai-document.js
```

```javascript
// backend/test-ai-document.js
const API_BASE_URL = 'http://localhost:3000/api/v1';
const TEST_TOKEN = 'your_test_user_jwt_token';

async function testDocumentExtraction() {
  console.log('🧪 Testing AI Document Extraction\n');

  // Test with a sample image URL
  const testRequest = {
    imageUrl: 'https://example.com/sample-registration.jpg',
    documentType: 'registration',
  };

  try {
    const response = await fetch(`${API_BASE_URL}/ai/extract-document`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequest),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ SUCCESS: Document processed\n');
      console.log('Confidence:', data.data.confidence);
      console.log('Document Type:', data.data.documentType);
      console.log('Extracted Data:', JSON.stringify(data.data.extractedData, null, 2));
      console.log('Processing Time:', data.data.processingTimeMs, 'ms');
    } else {
      console.error('❌ FAILED:', data);
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

testDocumentExtraction();
```

```bash
# Run test
node backend/test-ai-document.js
```

---

## 🎨 **WEEK 2: FRONTEND INTEGRATION**

### **Day 8-9: Upload Component**

#### **1. Install Dependencies**
```bash
cd website
npm install react-dropzone
```

#### **2. Create Component**
```bash
mkdir -p website/src/components/ai
touch website/src/components/ai/AIDocumentUpload.tsx
```

Copy the `AIDocumentUpload` component from the roadmap into this file.

#### **3. Create API Route (for file upload)**
```bash
touch website/src/app/api/upload/route.ts
```

```typescript
// website/src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `documents/${fileName}`;

    const { data, error } = await supabase.storage
      .from('shipment-documents')
      .upload(filePath, file);

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('shipment-documents')
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

### **Day 10: Frontend API Integration**

#### **1. Create AI API Client**
```bash
touch website/src/lib/ai-api.ts
```

```typescript
// website/src/lib/ai-api.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export interface ExtractedData {
  vin?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleColor?: string;
  ownerName?: string;
  licensePlate?: string;
}

export interface DocumentExtractionResult {
  documentType: string;
  confidence: number;
  extractedData: ExtractedData;
  requiresReview: boolean;
  processingTimeMs: number;
}

export async function extractDocumentData(
  imageUrl: string,
  token: string
): Promise<DocumentExtractionResult> {
  const response = await fetch(`${API_BASE_URL}/ai/extract-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageUrl }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to extract document data');
  }

  const result = await response.json();
  return result.data;
}
```

### **Day 11-12: Integration with ShipmentForm**

#### **1. Update ShipmentForm**
```typescript
// website/src/components/shipment/ShipmentForm.tsx

import AIDocumentUpload from '@/components/ai/AIDocumentUpload';

// Add state for AI-extracted data
const [aiExtractedData, setAiExtractedData] = useState<any>(null);

// Add callback handler
const handleAIDataExtracted = (data: any) => {
  console.log('AI extracted data:', data);
  
  // Auto-fill form fields
  if (data.vehicleMake) {
    updateFormData('vehicleMake', data.vehicleMake);
  }
  if (data.vehicleModel) {
    updateFormData('vehicleModel', data.vehicleModel);
  }
  if (data.vehicleYear) {
    updateFormData('vehicleYear', data.vehicleYear.toString());
  }
  if (data.vin) {
    updateFormData('vehicleVin', data.vin);
  }
  if (data.vehicleColor) {
    updateFormData('vehicleColor', data.vehicleColor);
  }
  
  setAiExtractedData(data);
  
  // Expand vehicle details section to show auto-filled data
  setExpandedSections(prev => ({ ...prev, vehicle: true }));
  
  // Show success notification
  // (You can use a toast library like sonner)
  alert('✅ Vehicle details auto-filled from document!');
};

// Add AI upload component before vehicle details fields
<CollapsibleSection
  title="Vehicle Details"
  icon={<Package className="h-5 w-5" />}
  isExpanded={expandedSections.vehicle}
  onToggle={() => toggleSection('vehicle')}
  isValid={sectionValidity.vehicle}
  summary={getSummary('vehicle')}
>
  {/* Add AI Upload at the top */}
  <div className="mb-6">
    <AIDocumentUpload onDataExtracted={handleAIDataExtracted} />
  </div>
  
  {/* Show indicator if AI data was used */}
  {aiExtractedData && (
    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
      <p className="text-sm text-green-900">
        ✨ Fields below were auto-filled from your document. 
        Please verify the information is correct.
      </p>
    </div>
  )}
  
  {/* Existing vehicle form fields */}
  ...
</CollapsibleSection>
```

### **Day 13-14: Testing & Refinement**

#### **1. End-to-End Testing**
- [ ] Upload vehicle registration → Verify VIN extraction
- [ ] Upload title → Verify make/model/year extraction
- [ ] Upload insurance card → Verify policy number extraction
- [ ] Test with blurry images → Verify low confidence handling
- [ ] Test with invalid documents → Verify error handling
- [ ] Test form auto-fill → Verify all fields populate correctly

#### **2. User Testing**
- [ ] Give access to 5-10 beta users
- [ ] Collect feedback on accuracy
- [ ] Monitor confidence scores
- [ ] Track processing times
- [ ] Measure form completion rate improvement

#### **3. Optimization**
- [ ] Add loading states
- [ ] Improve error messages
- [ ] Add retry mechanism
- [ ] Optimize image compression before upload
- [ ] Cache common results

---

## 📊 **MONITORING & METRICS**

### **Track These in Database:**

```sql
-- Query: Average confidence score
SELECT AVG(confidence_score) as avg_confidence
FROM ai_document_extractions
WHERE created_at > NOW() - INTERVAL '7 days';

-- Query: Documents requiring review
SELECT COUNT(*) as needs_review
FROM ai_document_extractions
WHERE requires_review = TRUE
AND reviewed_at IS NULL;

-- Query: Processing time stats
SELECT 
    AVG(processing_time_ms) as avg_ms,
    MIN(processing_time_ms) as min_ms,
    MAX(processing_time_ms) as max_ms
FROM ai_document_extractions
WHERE created_at > NOW() - INTERVAL '7 days';

-- Query: Most common document types
SELECT 
    document_type, 
    COUNT(*) as count
FROM ai_document_extractions
GROUP BY document_type
ORDER BY count DESC;
```

### **Set Up Alerts:**
- ⚠️ Alert if confidence < 0.70 (accuracy issue)
- ⚠️ Alert if processing_time > 10s (performance issue)
- ⚠️ Alert if error rate > 5% (system issue)

---

## 💰 **COST TRACKING**

### **Anthropic API Costs:**

```typescript
// backend/src/services/ai-document-processor.service.ts

// Add cost tracking
const COST_PER_REQUEST = 0.008; // $0.008 per image + text request

// After each successful extraction:
await supabaseAdmin.from('ai_costs').insert({
  user_id: userId,
  feature: 'document_extraction',
  cost_usd: COST_PER_REQUEST,
  created_at: new Date().toISOString(),
});

// Monthly cost query:
SELECT 
    SUM(cost_usd) as total_cost,
    COUNT(*) as total_requests
FROM ai_costs
WHERE created_at > NOW() - INTERVAL '30 days'
AND feature = 'document_extraction';
```

---

## 🎉 **SUCCESS CRITERIA**

### **Week 1 Complete When:**
- [x] AI service can extract VIN from registration (>90% accuracy)
- [x] API endpoint returns valid JSON
- [x] Database stores extraction results
- [x] Tests pass successfully

### **Week 2 Complete When:**
- [x] Frontend component renders correctly
- [x] File upload works
- [x] Form auto-fills from extracted data
- [x] Error handling works properly
- [x] 10 beta users test successfully

### **Production Ready When:**
- [x] 95%+ accuracy on common documents
- [x] Processing time < 5 seconds
- [x] Error rate < 2%
- [x] Cost < $100/month
- [x] User satisfaction > 8/10

---

## 🚨 **COMMON ISSUES & SOLUTIONS**

### **Issue: Low Confidence Scores**
**Solution:** 
- Improve image quality (client-side compression)
- Add preprocessing (contrast enhancement)
- Fine-tune AI prompt with examples
- Fall back to manual entry for confidence < 0.70

### **Issue: Slow Processing**
**Solution:**
- Add request queue (Bull/Redis)
- Implement response caching
- Use smaller AI model for simple docs
- Show progress indicator to user

### **Issue: High Costs**
**Solution:**
- Cache common documents (same VIN)
- Rate limit per user (5 extractions/day free)
- Use cheaper model (Claude Haiku) for retry attempts
- Batch process multiple documents

---

## 📚 **RESOURCES**

- **Anthropic Docs:** https://docs.anthropic.com/
- **Claude Vision Guide:** https://docs.anthropic.com/claude/docs/vision
- **Supabase Storage:** https://supabase.com/docs/guides/storage
- **React Dropzone:** https://react-dropzone.js.org/

---

## 🎯 **NEXT PHASE**

Once Document AI is complete, move to:
1. **Intelligent Pricing AI** (Week 3)
2. **Natural Language Quotes** (Week 4-6)
3. **AI Chatbot** (Week 7-8)

**This is just the beginning! 🚀**

---

## ❓ **NEED HELP?**

If you encounter issues:
1. Check backend logs: `railway logs`
2. Check Supabase logs: Supabase Dashboard → Logs
3. Test API endpoint: Use Postman/Insomnia
4. Debug AI responses: Log raw AI output

**Let's build something amazing! 💪**
