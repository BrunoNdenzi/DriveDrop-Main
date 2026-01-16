# 🧪 AI API Testing Guide - Complete Test Suite

## Prerequisites

1. **OpenAI API Key Added to Railway** ✅
2. **Backend Deployed** ✅
3. **Valid JWT Token** (login to get auth token)

## Get Your JWT Token

```bash
# Login to get token
curl -X POST https://your-backend.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { ... }
# }

# Save this token for subsequent requests
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Test 1: Document Extraction (AI-Powered OCR)

### Test with Sample Vehicle Registration

```bash
# Replace YOUR_BACKEND_URL and JWT_TOKEN
curl -X POST https://your-backend.railway.app/api/v1/ai/extract-document \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "document=@/path/to/vehicle-registration.jpg" \
  -F "documentType=registration"
```

### Expected Success Response

```json
{
  "success": true,
  "data": {
    "vin": "1HGBH41JXMN109186",
    "year": 2023,
    "make": "Honda",
    "model": "Civic",
    "color": "Silver",
    "licensePlate": "ABC123",
    "registrationExpiry": "2025-12-31",
    "ownerName": "John Doe",
    "ownerAddress": "123 Main St, Los Angeles, CA 90001"
  },
  "confidence": 0.95,
  "requiresReview": false,
  "lowConfidenceFields": [],
  "message": "Document extracted successfully"
}
```

### Expected Low Confidence Response

```json
{
  "success": true,
  "data": {
    "vin": "1HGBH41JXMN109186",
    "year": 2023,
    "make": "Honda",
    "model": "Civic",
    "color": null,
    "licensePlate": "AB?123"
  },
  "confidence": 0.78,
  "requiresReview": true,
  "lowConfidenceFields": ["licensePlate", "color"],
  "message": "Document extracted but requires human review due to low confidence"
}
```

### Test Different Document Types

```bash
# Vehicle Title
curl -X POST https://your-backend.railway.app/api/v1/ai/extract-document \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "document=@/path/to/title.jpg" \
  -F "documentType=title"

# Insurance Card
curl -X POST https://your-backend.railway.app/api/v1/ai/extract-document \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "document=@/path/to/insurance.jpg" \
  -F "documentType=insurance"

# Bill of Sale
curl -X POST https://your-backend.railway.app/api/v1/ai/extract-document \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "document=@/path/to/bill-of-sale.jpg" \
  -F "documentType=bill_of_sale"
```

---

## Test 2: Natural Language Shipment Creation

### Test Case 1: Simple Request

```bash
curl -X POST https://your-backend.railway.app/api/v1/ai/natural-language-shipment \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ship my 2023 Honda Civic from Los Angeles, CA to New York, NY next week",
    "inputMethod": "text"
  }'
```

### Expected Response

```json
{
  "success": true,
  "shipment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "client_id": "your-user-id",
    "title": "2023 Honda Civic",
    "vehicle_year": 2023,
    "vehicle_make": "Honda",
    "vehicle_model": "Civic",
    "pickup_address": "Los Angeles, CA",
    "pickup_city": "Los Angeles",
    "pickup_state": "CA",
    "delivery_address": "New York, NY",
    "delivery_city": "New York",
    "delivery_state": "NY",
    "pickup_date": "2026-01-23T00:00:00Z",
    "estimated_price": 1250.00,
    "status": "pending",
    "payment_status": "pending",
    "created_at": "2026-01-16T12:00:00Z"
  },
  "extractedData": {
    "vehicle": {
      "year": 2023,
      "make": "Honda",
      "model": "Civic"
    },
    "pickup": {
      "location": "Los Angeles, CA",
      "date": "2026-01-23"
    },
    "delivery": {
      "location": "New York, NY"
    },
    "urgency": "standard"
  },
  "confidence": 0.92,
  "validationWarnings": [],
  "message": "Shipment created successfully from natural language"
}
```

### Test Case 2: Complex Request with VIN

```bash
curl -X POST https://your-backend.railway.app/api/v1/ai/natural-language-shipment \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "I need to transport my Honda Civic VIN 1HGBH41JXMN109186 from 123 Main St, Los Angeles CA 90001 to 456 Oak Ave, New York NY 10001 by January 25th. The car is not drivable.",
    "inputMethod": "text"
  }'
```

### Expected Response with Full Details

```json
{
  "success": true,
  "shipment": {
    "id": "...",
    "vehicle_vin": "1HGBH41JXMN109186",
    "vehicle_make": "Honda",
    "vehicle_model": "Civic",
    "pickup_address": "123 Main St, Los Angeles CA 90001",
    "delivery_address": "456 Oak Ave, New York NY 10001",
    "pickup_date": "2026-01-25T00:00:00Z",
    "is_operable": false,
    "estimated_price": 1450.00
  },
  "confidence": 0.95,
  "validationWarnings": ["Price increased due to non-operable vehicle"]
}
```

### Test Case 3: Voice Input Simulation

```bash
curl -X POST https://your-backend.railway.app/api/v1/ai/natural-language-shipment \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "ship my two thousand twenty three honda civic from LA to NYC as soon as possible",
    "inputMethod": "voice"
  }'
```

### Test Case 4: Multiple Vehicles (Should Fail)

```bash
curl -X POST https://your-backend.railway.app/api/v1/ai/natural-language-shipment \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ship my 2023 Honda Civic and 2021 Tesla Model 3 from LA to NYC",
    "inputMethod": "text"
  }'
```

### Expected Error Response

```json
{
  "error": "Failed to parse natural language prompt",
  "details": "Multiple vehicles detected. Please create separate shipments.",
  "validationErrors": ["Multiple vehicles in single prompt"],
  "extractedData": {
    "vehicles": [
      {"year": 2023, "make": "Honda", "model": "Civic"},
      {"year": 2021, "make": "Tesla", "model": "Model 3"}
    ]
  }
}
```

---

## Test 3: Bulk CSV Upload

### Prepare Test CSV

Create `test-shipments.csv`:

```csv
pickup_address,delivery_address,vehicle_year,vehicle_make,vehicle_model,vehicle_vin,is_operable,special_instructions
"123 Main St, Los Angeles, CA 90001","456 Oak Ave, New York, NY 10001",2023,Honda,Civic,1HGBH41JXMN109186,true,"Handle with care"
"789 Pine Rd, Miami, FL 33101","321 Elm St, Seattle, WA 98101",2021,Tesla,Model 3,5YJ3E1EA1MF000001,true,"Enclosed transport preferred"
"555 Maple Dr, Dallas, TX 75201","999 Cedar Ln, Boston, MA 02101",2019,Ford,F-150,1FTFW1E84KFA00001,false,"Non-running vehicle"
```

### Upload CSV

```bash
curl -X POST https://your-backend.railway.app/api/v1/ai/bulk-upload \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "file=@test-shipments.csv"
```

### Expected Response

```json
{
  "success": true,
  "uploadId": "bulk-550e8400-e29b-41d4-a716-446655440000",
  "totalRows": 3,
  "status": "pending",
  "message": "Bulk upload started successfully"
}
```

### Check Upload Progress

```bash
curl https://your-backend.railway.app/api/v1/ai/bulk-upload/bulk-550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Expected Progress Response

```json
{
  "success": true,
  "upload": {
    "id": "bulk-550e8400-e29b-41d4-a716-446655440000",
    "file_name": "test-shipments.csv",
    "total_rows": 3,
    "processed_rows": 3,
    "successful_rows": 3,
    "failed_rows": 0,
    "status": "completed",
    "progress_percent": 100,
    "created_shipment_ids": [
      "shipment-id-1",
      "shipment-id-2",
      "shipment-id-3"
    ],
    "errors": [],
    "created_at": "2026-01-16T12:00:00Z",
    "completed_at": "2026-01-16T12:00:15Z"
  }
}
```

---

## Test 4: Document Queue Management

### View Pending Extractions

```bash
curl https://your-backend.railway.app/api/v1/ai/document-queue \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Expected Response

```json
{
  "success": true,
  "queue": [
    {
      "id": "extraction-id-1",
      "document_type": "registration",
      "status": "pending",
      "confidence_score": null,
      "created_at": "2026-01-16T12:00:00Z"
    },
    {
      "id": "extraction-id-2",
      "document_type": "title",
      "status": "processing",
      "confidence_score": null,
      "started_processing_at": "2026-01-16T12:00:05Z"
    },
    {
      "id": "extraction-id-3",
      "document_type": "insurance",
      "status": "review_required",
      "confidence_score": 0.78,
      "requires_human_review": true,
      "completed_at": "2026-01-16T11:59:00Z"
    }
  ],
  "count": 3
}
```

### Review Low-Confidence Extraction

```bash
curl -X POST https://your-backend.railway.app/api/v1/ai/review-extraction/extraction-id-3 \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "corrections": {
      "licensePlate": "ABC123",
      "color": "Silver"
    },
    "notes": "License plate was blurry in photo, manually verified."
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": "Extraction reviewed and corrected successfully"
}
```

---

## Test 5: Integration with Existing Endpoints

### Create Shipment with AI-Extracted Data

```bash
# Step 1: Extract document
EXTRACTION_RESPONSE=$(curl -X POST https://your-backend.railway.app/api/v1/ai/extract-document \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "document=@registration.jpg" \
  -F "documentType=registration")

# Step 2: Parse VIN from response
VIN=$(echo $EXTRACTION_RESPONSE | jq -r '.data.vin')
YEAR=$(echo $EXTRACTION_RESPONSE | jq -r '.data.year')
MAKE=$(echo $EXTRACTION_RESPONSE | jq -r '.data.make')
MODEL=$(echo $EXTRACTION_RESPONSE | jq -r '.data.model')

# Step 3: Create shipment with extracted data
curl -X POST https://your-backend.railway.app/api/v1/shipments \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"pickup_address\": \"Los Angeles, CA\",
    \"delivery_address\": \"New York, NY\",
    \"vehicle_year\": $YEAR,
    \"vehicle_make\": \"$MAKE\",
    \"vehicle_model\": \"$MODEL\",
    \"vehicle_vin\": \"$VIN\",
    \"is_operable\": true
  }"
```

---

## Test 6: Error Handling

### Test Invalid Document Upload

```bash
curl -X POST https://your-backend.railway.app/api/v1/ai/extract-document \
  -H "Authorization: Bearer $JWT_TOKEN"
# Missing file
```

**Expected:** `400 Bad Request - No document uploaded`

### Test Invalid Natural Language

```bash
curl -X POST https://your-backend.railway.app/api/v1/ai/natural-language-shipment \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "random gibberish text that makes no sense",
    "inputMethod": "text"
  }'
```

**Expected:** `400 Bad Request - Failed to parse natural language prompt`

### Test Missing API Key

```bash
# Temporarily remove OPENAI_API_KEY from Railway
curl -X POST https://your-backend.railway.app/api/v1/ai/extract-document \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "document=@registration.jpg" \
  -F "documentType=registration"
```

**Expected:** `500 Internal Server Error - OpenAI API key not configured`

---

## Performance Benchmarks

| Test | Expected Time | Success Criteria |
|------|---------------|------------------|
| Document Extraction | 2-5 seconds | `confidence >= 0.85` |
| Natural Language | 1-3 seconds | `confidence >= 0.80` |
| Bulk Upload (100 rows) | 30-60 seconds | `successful_rows >= 95` |
| Document Queue | <500ms | Returns pending items |

---

## Database Verification Queries

### Check AI Activity

```sql
-- Today's document extractions
SELECT 
  COUNT(*) as total_extractions,
  AVG(confidence_score) as avg_confidence,
  SUM(CASE WHEN requires_human_review THEN 1 ELSE 0 END) as needs_review
FROM document_extraction_queue
WHERE created_at >= CURRENT_DATE;

-- Natural language shipments
SELECT 
  COUNT(*) as total_prompts,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  AVG(ai_confidence) as avg_confidence,
  AVG(processing_time_ms) as avg_time_ms
FROM ai_shipment_prompts
WHERE created_at >= CURRENT_DATE;

-- Bulk uploads
SELECT 
  id,
  file_name,
  total_rows,
  successful_rows,
  failed_rows,
  progress_percent,
  status
FROM bulk_uploads
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;
```

---

## Monitoring & Alerts

### Set Up Cost Monitoring

```sql
-- Estimated daily AI costs
SELECT 
  DATE(created_at) as date,
  COUNT(*) as document_extractions,
  COUNT(*) * 1.50 as estimated_cost_usd
FROM document_extraction_queue
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Success Rate Monitoring

```sql
-- AI feature success rates
SELECT 
  'Document Extraction' as feature,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2) as success_rate
FROM document_extraction_queue
UNION ALL
SELECT 
  'Natural Language',
  COUNT(*),
  SUM(CASE WHEN success THEN 1 ELSE 0 END),
  ROUND(SUM(CASE WHEN success THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2)
FROM ai_shipment_prompts
UNION ALL
SELECT 
  'Bulk Upload',
  COUNT(*),
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
  ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2)
FROM bulk_uploads;
```

---

## Troubleshooting Common Issues

### Issue: High Response Times

```bash
# Check processing times
curl https://your-backend.railway.app/api/v1/ai/document-queue \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.queue[] | {id, processing_time_ms}'
```

**Solution:** If >5000ms, check OpenAI API status or increase timeout

### Issue: Low Confidence Scores

```sql
-- Find problematic document types
SELECT 
  document_type,
  COUNT(*) as total,
  AVG(confidence_score) as avg_confidence
FROM document_extraction_queue
WHERE confidence_score < 0.85
GROUP BY document_type;
```

**Solution:** Improve document quality or adjust confidence threshold

### Issue: Failed Bulk Uploads

```sql
-- View errors
SELECT 
  file_name,
  errors
FROM bulk_uploads
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 5;
```

**Solution:** Check CSV format, validate data types

---

## 🎉 Success Criteria

Your AI integration is working correctly if:

✅ Document extraction returns `confidence >= 0.85` for 90%+ of uploads  
✅ Natural language creates valid shipments with `confidence >= 0.80`  
✅ Bulk uploads process 95%+ rows successfully  
✅ API response times < 5 seconds  
✅ Error rate < 5%  
✅ Daily AI costs < $5 for normal usage  

---

## Next Steps

1. ✅ Complete all tests above
2. ✅ Verify 90%+ success rates
3. ✅ Monitor costs for 48 hours
4. ✅ Beta test with 10 real users
5. ✅ Build frontend components
6. ✅ Launch to production! 🚀
