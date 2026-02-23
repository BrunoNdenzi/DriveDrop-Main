# Benji AI — Architecture, Cost Analysis & Optimization Guide

> **DriveDrop's Intelligent AI Engine**  
> Last Updated: February 2025  
> Version: 2.0 (Tiered Models + Cost Optimization)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [AI Features & Model Usage](#ai-features--model-usage)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Model Strategy](#model-strategy)
5. [Cost Analysis](#cost-analysis)
6. [Optimization Implementations](#optimization-implementations)
7. [Rate Limiting](#rate-limiting)
8. [API Endpoints](#api-endpoints)
9. [Monitoring & Admin Dashboard](#monitoring--admin-dashboard)
10. [Testing Guide](#testing-guide)

---

## Architecture Overview

Benji AI is DriveDrop's integrated AI engine spanning **6 services** across the backend. Four services call OpenAI's API, while two use pure algorithmic intelligence.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DRIVEDROP FRONTEND                          │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────┐ │
│  │  BenjiChat    │ │  NL Shipment │ │  Doc Scanner  │ │  Driver  │ │
│  │  Component    │ │  Creator     │ │  Component    │ │  Loads   │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬────────┘ └────┬─────┘ │
│         │                │                │               │        │
└─────────┼────────────────┼────────────────┼───────────────┼────────┘
          │                │                │               │
          ▼                ▼                ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS BACKEND (Railway)                     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   ai.routes.ts                                │   │
│  │  POST /chat  POST /nl-shipment  POST /extract-doc            │   │
│  │  POST /dispatcher/analyze  GET /loads/recommendations         │   │
│  │  GET /usage/summary  GET /cache/stats                         │   │
│  └──────┬──────────┬──────────────┬──────────┬──────────────────┘   │
│         │          │              │          │                       │
│  ┌──────▼──────┐ ┌─▼────────────┐│ ┌────────▼────────┐             │
│  │ Rate Limit  │ │ Auth Middle- ││ │ Token Tracking  │             │
│  │ Middleware   │ │ ware         ││ │ (ai.config.ts)  │             │
│  └──────┬──────┘ └──────────────┘│ └────────┬────────┘             │
│         │                        │          │                       │
│  ┌──────▼──────────────────────────────────▼────────────────────┐   │
│  │                    AI SERVICE LAYER                           │   │
│  │                                                               │   │
│  │  ┌─────────────────┐  ┌──────────────────────────┐           │   │
│  │  │ BenjiChat       │  │ NaturalLanguageShipment   │           │   │
│  │  │ Service         │  │ Service                    │           │   │
│  │  │ ───────────     │  │ ──────────────────         │           │   │
│  │  │ GPT-4o-mini     │  │ GPT-4o                     │           │   │
│  │  │ 1000 max tokens │  │ 2000 max tokens            │           │   │
│  │  │ temp: 0.7       │  │ temp: 0.1                  │           │   │
│  │  │ + Response Cache│  │ JSON response format       │           │   │
│  │  └────────┬────────┘  └──────────┬───────────────┘           │   │
│  │           │                      │                            │   │
│  │  ┌────────▼────────┐  ┌──────────▼───────────────┐           │   │
│  │  │ AIDocument      │  │ BenjiDispatcher           │           │   │
│  │  │ Extraction      │  │ Service                    │           │   │
│  │  │ ──────────      │  │ ──────────────             │           │   │
│  │  │ GPT-4o Vision   │  │ NO OpenAI                  │           │   │
│  │  │ + GPT-4o Text   │  │ Pure algorithmic matching  │           │   │
│  │  │ 2000+1500 tokens│  │ Multi-factor scoring       │           │   │
│  │  └────────┬────────┘  └──────────┬───────────────┘           │   │
│  │           │                      │                            │   │
│  │  ┌────────▼──────────────────────▼───────────────┐           │   │
│  │  │ BenjiLoadRecommendation Service               │           │   │
│  │  │ ───────────────────────────                    │           │   │
│  │  │ NO OpenAI — Pure scoring algorithm             │           │   │
│  │  │ Personalized driver load ranking               │           │   │
│  │  └───────────────────────────────────────────────┘           │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│         ┌──────────┐          ┌──────────┐                          │
│         │ OpenAI   │          │ Supabase │                          │
│         │ API      │◄────────►│ Database │                          │
│         └──────────┘          └──────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## AI Features & Model Usage

### Feature Matrix

| Feature | Service | Model | OpenAI? | Tokens (max) | Temperature | Purpose |
|---------|---------|-------|---------|-------------|-------------|---------|
| **Benji Chat** | BenjiChatService | GPT-4o-mini | ✅ Yes | 1,000 | 0.7 | Conversational AI assistant for all user types |
| **NL Shipment** | NaturalLanguageShipmentService | GPT-4o | ✅ Yes | 2,000 | 0.1 | Parse "Ship my car from A to B" into structured data |
| **Document OCR** | AIDocumentExtractionService | GPT-4o Vision | ✅ Yes | 2,000 | 0.1 | Extract text from vehicle document images |
| **Document Parse** | AIDocumentExtractionService | GPT-4o | ✅ Yes | 1,500 | 0.1 | Convert OCR text into structured JSON |
| **Auto-Dispatch** | BenjiDispatcherService | — | ❌ No | — | — | Algorithmic driver-load matching |
| **Load Recs** | BenjiLoadRecommendationService | — | ❌ No | — | — | Personalized load scoring for drivers |

### How Each Feature Uses AI

#### 1. Benji Chat (GPT-4o-mini)
```
User types message → Role-specific system prompt injected →
GPT-4o-mini generates response → Confidence scored →
Contextual suggestions generated → Response cached for reuse
```
- **System Prompt**: Varies by role (client/driver/admin/broker)
- **Driver prompts** include Carolina-specific corridor knowledge (I-85, I-77, I-40 traffic)
- **Fallback**: Keyword-based responses when OpenAI is unavailable
- **Cache**: 30-minute TTL on identical queries

#### 2. Natural Language Shipment (GPT-4o)
```
"Ship my 2023 Civic from LA to NY" → GPT-4o extracts JSON →
{vehicle: {year: 2023, make: Honda, model: Civic},
 pickup: {location: "Los Angeles"},
 delivery: {location: "New York"}} →
Google Maps distance calc → Pricing engine → Shipment created
```
- **Response Format**: `json_object` for guaranteed valid JSON
- **Fallback**: Regex-based parsing when OpenAI is down (70% confidence)
- **Logging**: Each prompt saved to `ai_shipment_prompts` table for training

#### 3. Document Extraction (GPT-4o Vision + GPT-4o)
```
Document image uploaded → Queue created in Supabase →
Step 1: GPT-4o Vision OCR (extract raw text from image) →
Step 2: GPT-4o text parsing (structured JSON extraction) →
Confidence scoring → ≥0.85 auto-approve / <0.85 human review queue
```
- **Two-step pipeline**: Vision for OCR, then text model for structure
- **Document Types**: Bill of Sale, Title, Insurance, Inspection Report
- **Output**: vehicle_info, seller_info, buyer_info, sale_info, insurance_info

#### 4. Auto-Dispatcher (No AI — Algorithmic)
```
Unassigned loads fetched → Available drivers fetched →
Multi-factor scoring: distance (40%) + rating (20%) +
route fit (25%) + capacity (15%) → Ranked matches →
Admin reviews or auto-assigns
```
- Pure math + database queries — zero OpenAI cost
- Processes 47 loads in ~5 seconds

#### 5. Load Recommendations (No AI — Algorithmic)
```
Driver profile analyzed → Available loads scored →
Factors: distance, route alignment, pay rate, vehicle type match →
Categorized: best / good / consider → Sorted by score
```
- Pure scoring algorithm — zero OpenAI cost
- Personalized per driver's history and preferences

---

## Data Flow Diagrams

### Benji Chat Flow

```mermaid
sequenceDiagram
    participant U as User (Client/Driver/Admin)
    participant F as Frontend (BenjiChat.tsx)
    participant R as AI Routes
    participant RL as Rate Limiter
    participant C as Response Cache
    participant S as BenjiChatService
    participant O as OpenAI GPT-4o-mini
    participant T as Token Tracker

    U->>F: Types message
    F->>R: POST /api/v1/ai/chat
    R->>RL: Check rate limit (20/min)
    
    alt Rate limit exceeded
        RL-->>R: 429 Too Many Requests
        R-->>F: Error + retry-after
    else Within limit
        RL->>R: OK
        R->>S: chat(messages, context)
        S->>C: Check cache
        
        alt Cache HIT
            C-->>S: Cached response
            S-->>R: Response (cached: true)
        else Cache MISS
            S->>O: GPT-4o-mini completion
            O-->>S: Response + usage tokens
            S->>T: Track tokens + cost
            S->>C: Store in cache (30min TTL)
            S-->>R: Response + tokenUsage
        end
        
        R-->>F: JSON response
        F-->>U: Display message + suggestions
    end
```

### Document Extraction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (DocScanner)
    participant R as AI Routes
    participant RL as Rate Limiter
    participant S as AIDocExtractionService
    participant DB as Supabase
    participant V as GPT-4o Vision
    participant G as GPT-4o Text
    participant T as Token Tracker

    U->>F: Upload document image
    F->>R: POST /api/v1/ai/extract-document
    R->>RL: Check rate limit (10/min)
    RL->>R: OK
    
    R->>S: queueDocument(fileUrl, type)
    S->>DB: Insert into extraction queue
    DB-->>S: queue_id
    
    R->>S: processDocument(queue_id)
    
    Note over S,V: Step 1: OCR
    S->>V: GPT-4o Vision (image → text)
    V-->>S: Raw extracted text
    S->>T: Track OCR tokens (~800 in, ~600 out)
    
    Note over S,G: Step 2: Parse
    S->>G: GPT-4o (text → JSON)
    G-->>S: Structured data (vehicle, seller, etc.)
    S->>T: Track extraction tokens (~600 in, ~500 out)
    
    S->>S: Calculate confidence score
    
    alt Confidence ≥ 0.85
        S->>DB: Auto-approve extraction
        S-->>R: Success (requiresReview: false)
    else Confidence < 0.85
        S->>DB: Add to review queue
        S-->>R: Success (requiresReview: true)
    end
    
    R-->>F: Extracted data + confidence
    F-->>U: Display results
```

### Natural Language Shipment Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant R as AI Routes
    participant RL as Rate Limiter
    participant S as NLShipmentService
    participant DB as Supabase
    participant O as GPT-4o
    participant G as Google Maps
    participant P as Pricing Engine
    participant T as Token Tracker

    U->>F: "Ship my 2023 Civic from LA to NY"
    F->>R: POST /api/v1/ai/natural-language-shipment
    R->>RL: Check rate limit (15/min)
    RL->>R: OK
    
    R->>S: parseShipment(prompt, userId)
    S->>DB: Log prompt to ai_shipment_prompts
    
    S->>O: GPT-4o parse (JSON response format)
    O-->>S: {vehicle, pickup, delivery, preferences}
    S->>T: Track tokens ($0.005/call avg)
    
    S->>S: Analyze completeness
    Note over S: Confidence score + missing fields
    
    S->>G: Get directions (pickup → delivery)
    G-->>S: Distance in miles
    
    S->>P: Calculate quote (vehicle type + distance)
    P-->>S: Estimated price
    
    S->>DB: Create shipment record
    DB-->>S: shipment_id
    
    S-->>R: Success + shipment + confidence
    R-->>F: JSON response
    F-->>U: "Created! 2023 Honda Civic, LA→NY, $950"
```

### Dispatcher & Load Recommendations (No AI)

```mermaid
flowchart LR
    subgraph "Auto-Dispatcher (Algorithmic)"
        A1[Unassigned Loads] --> B1[Fetch Available Drivers]
        B1 --> C1[Multi-Factor Score]
        C1 --> D1{Score Factors}
        D1 -->|40%| E1[Distance Proximity]
        D1 -->|25%| E2[Route Fit]
        D1 -->|20%| E3[Driver Rating]
        D1 -->|15%| E4[Capacity Match]
        E1 --> F1[Ranked Matches]
        E2 --> F1
        E3 --> F1
        E4 --> F1
        F1 --> G1[Admin Review / Auto-Assign]
    end

    subgraph "Load Recommendations (Algorithmic)"
        A2[Driver Profile] --> B2[Available Loads]
        B2 --> C2[Score Each Load]
        C2 --> D2[Categorize]
        D2 -->|High Score| E5[🟢 Best]
        D2 -->|Medium| E6[🟡 Good]
        D2 -->|Low| E7[⚪ Consider]
    end

    style E1 fill:#4ade80
    style E2 fill:#60a5fa
    style E3 fill:#fbbf24
    style E4 fill:#a78bfa
```

---

## Model Strategy

### Tiered Model Approach

We use a **tiered model strategy** to optimize cost without sacrificing quality:

```
┌──────────────────────────────────────────────────────────────┐
│                    MODEL TIER STRATEGY                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  TIER 1: GPT-4o (Full Power)                                │
│  ├── Document OCR Vision      (needs multimodal)            │
│  ├── Document Data Extraction (needs precision)             │
│  └── NL Shipment Parsing      (needs structured JSON)       │
│                                                              │
│  TIER 2: GPT-4o-mini (Cost Efficient)                       │
│  └── Benji Chat               (conversational, simpler)     │
│                                                              │
│  TIER 3: No AI (Algorithmic)                                │
│  ├── Auto-Dispatcher          (math + DB queries)           │
│  └── Load Recommendations     (scoring algorithm)           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Cost Savings: Chat moved from GPT-4o → GPT-4o-mini         │
│  Result: ~95% cost reduction on chat (highest volume API)    │
│  Quality: GPT-4o-mini is still excellent for conversation    │
└──────────────────────────────────────────────────────────────┘
```

### Why GPT-4o for Complex Tasks?

| Capability | GPT-4o | GPT-4o-mini | Why It Matters |
|-----------|--------|-------------|----------------|
| Vision/Image Understanding | ✅ Excellent | ❌ Limited | Document OCR requires high-detail image parsing |
| Structured JSON Output | ✅ 99%+ valid | ✅ ~97% valid | NL shipment parsing needs guaranteed valid JSON |
| Nuanced Text Understanding | ✅ Best-in-class | ✅ Very good | Chat is great on mini; extraction needs full model |
| Cost per 1M tokens (input) | $2.50 | $0.15 | Mini is **16.7x cheaper** for input |
| Cost per 1M tokens (output) | $10.00 | $0.60 | Mini is **16.7x cheaper** for output |

---

## Cost Analysis

### Per-Call Cost Breakdown

| Service | Model | Avg Input Tokens | Avg Output Tokens | Cost Per Call |
|---------|-------|-----------------|-------------------|---------------|
| Benji Chat | GPT-4o-mini | ~300 | ~200 | **$0.00017** |
| NL Shipment | GPT-4o | ~500 | ~400 | **$0.00525** |
| Document OCR | GPT-4o Vision | ~800 | ~600 | **$0.00800** |
| Document Parse | GPT-4o | ~600 | ~500 | **$0.00650** |
| Auto-Dispatcher | None | — | — | **$0.00** |
| Load Recs | None | — | — | **$0.00** |

### Monthly Cost Projections

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   MONTHLY COST PROJECTION                               │
├────────────────┬──────────────┬──────────────┬──────────────────────────┤
│                │   Startup    │   Growth     │   Scale                  │
│                │  (50 users)  │ (500 users)  │ (5,000 users)            │
├────────────────┼──────────────┼──────────────┼──────────────────────────┤
│ Chat calls     │     500      │    5,000     │    50,000                │
│ Chat cost      │    $0.09     │    $0.85     │     $8.50                │
│                │              │              │                          │
│ Shipment calls │     100      │    1,000     │    10,000                │
│ Shipment cost  │    $0.53     │    $5.25     │    $52.50                │
│                │              │              │                          │
│ Doc calls      │      50      │      500     │     5,000                │
│ Doc cost       │    $0.73     │    $7.25     │    $72.50                │
│                │              │              │                          │
│ ════════════   │ ═══════════  │ ═══════════  │ ═══════════              │
│ TOTAL/MONTH    │   ~$1.35     │  ~$13.35     │  ~$133.50               │
│ Per user/month │   $0.027     │   $0.027     │    $0.027                │
└────────────────┴──────────────┴──────────────┴──────────────────────────┘
```

### Cost Savings from Optimizations

| Optimization | Before | After | Savings |
|-------------|--------|-------|---------|
| Chat → GPT-4o-mini | $0.004/call | $0.00017/call | **95.8%** |
| Response Caching (30min) | Every call hits API | ~40% cache hits | **~40%** on chat |
| Rate Limiting | Unlimited calls | 20 chat/min, 10 doc/min | Prevents abuse |
| Token Tracking | No visibility | Real-time cost dashboard | Enables optimization |

### Annual Cost Comparison (500 users)

```
                    BEFORE OPTIMIZATION         AFTER OPTIMIZATION
                    ┌──────────────────┐       ┌──────────────────┐
  Chat (GPT-4o)     │    $240/year     │  →    │      $6/year     │  GPT-4o-mini
  + Cache           │                  │       │     ($3.60)      │  + 40% cache
  NL Shipment       │     $63/year     │  →    │     $63/year     │  (no change)
  Documents         │     $87/year     │  →    │     $87/year     │  (no change)
                    ├──────────────────┤       ├──────────────────┤
  TOTAL             │   ~$390/year     │  →    │   ~$153/year     │
                    └──────────────────┘       └──────────────────┘
                                                Savings: ~$237/year (61%)
```

---

## Optimization Implementations

### 1. Token Usage Tracking (`ai.config.ts`)

Every OpenAI API call now records:
- **Service name** (benji-chat, nl-shipment, document-ocr, document-extraction)
- **Model used** (gpt-4o or gpt-4o-mini)
- **Token counts** (prompt + completion + total)
- **Estimated cost** in USD
- **User ID** for per-user analytics
- **Duration** in milliseconds
- **Timestamp** for daily/weekly/monthly aggregation

```typescript
// Example log output:
// [AI Usage] benji-chat | gpt-4o-mini | 487 tokens | $0.000165 | 342ms
// [AI Usage] nl-shipment | gpt-4o | 1243 tokens | $0.005120 | 1205ms
// [AI Usage] document-ocr | gpt-4o | 1890 tokens | $0.008200 | 2340ms
```

### 2. Tiered Model Selection (`ai.config.ts`)

```typescript
SERVICE_MODEL_MAP = {
  'benji-chat':          GPT-4o-mini,  // Cost efficient for conversation
  'nl-shipment':         GPT-4o,       // Needs precision for JSON extraction
  'document-ocr':        GPT-4o,       // Needs vision capabilities
  'document-extraction': GPT-4o,       // Needs precision for structured data
}
```

### 3. Response Cache (`ai.config.ts → AIResponseCache`)

- **Storage**: In-memory Map (500 entry max)
- **TTL**: 30 minutes per entry
- **Key**: Service name + normalized query text
- **Hit tracking**: Counts reuse for analytics
- **Best for**: Repeated Benji chat questions ("How do I track my shipment?")

### 4. Rate Limiting (`ai-rate-limit.middleware.ts`)

| Endpoint | Max/Minute | Burst Limit | Burst Window |
|----------|-----------|-------------|--------------|
| `/chat` | 20 | 5 per 10s | 10 seconds |
| `/extract-document` | 10 | 3 per 10s | 10 seconds |
| `/natural-language-shipment` | 15 | 4 per 10s | 10 seconds |

Returns `429 Too Many Requests` with:
- `Retry-After` header
- `X-RateLimit-Limit` / `X-RateLimit-Remaining` headers
- Human-readable error message

---

## Rate Limiting

### Architecture

```mermaid
flowchart TD
    A[Incoming AI Request] --> B{Authenticated?}
    B -->|No| C[401 Unauthorized]
    B -->|Yes| D{Rate Limit Check}
    
    D --> E{Burst Limit OK?}
    E -->|No| F[429 Burst Exceeded<br>Wait a few seconds]
    
    E -->|Yes| G{Window Limit OK?}
    G -->|No| H[429 Rate Exceeded<br>Retry-After header]
    
    G -->|Yes| I[Record Timestamp]
    I --> J[Process AI Request]
    J --> K[Set X-RateLimit Headers]
    K --> L[Return Response]

    style C fill:#ef4444,color:#fff
    style F fill:#f59e0b,color:#000
    style H fill:#f59e0b,color:#000
    style L fill:#22c55e,color:#000
```

### Per-User Sliding Window

Rate limits are tracked **per-user** using the authenticated user ID. Each request timestamp is stored in a sliding window. Old timestamps are automatically cleaned up every 5 minutes to prevent memory leaks.

---

## API Endpoints

### AI Feature Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/api/v1/ai/chat` | ✅ | 20/min | Benji AI chat conversation |
| POST | `/api/v1/ai/natural-language-shipment` | ✅ | 15/min | Parse NL → shipment |
| POST | `/api/v1/ai/extract-document` | ✅ | 10/min | Document OCR + extraction |
| POST | `/api/v1/ai/bulk-upload` | ✅ | — | CSV bulk upload |
| GET | `/api/v1/ai/bulk-upload/:id` | ✅ | — | Check bulk upload status |
| GET | `/api/v1/ai/document-queue` | ✅ | — | Pending extraction queue |
| POST | `/api/v1/ai/review-extraction/:id` | ✅ | — | Human review extraction |
| POST | `/api/v1/ai/dispatcher/analyze` | ✅ Admin | — | Analyze dispatch opportunities |
| POST | `/api/v1/ai/dispatcher/auto-assign` | ✅ Admin | — | Auto-assign loads to drivers |
| GET | `/api/v1/ai/loads/recommendations/:id` | ✅ | — | Driver load recommendations |

### Admin Monitoring Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/ai/usage/summary` | ✅ Admin | Token usage + cost summary |
| GET | `/api/v1/ai/usage/recent` | ✅ Admin | Recent API calls with details |
| GET | `/api/v1/ai/cache/stats` | ✅ Admin | Cache hit rates + top queries |
| POST | `/api/v1/ai/cache/clear` | ✅ Admin | Clear response cache |

---

## Monitoring & Admin Dashboard

### Usage Summary Response

```json
GET /api/v1/ai/usage/summary?startDate=2025-02-01

{
  "success": true,
  "usage": {
    "totalCalls": 1247,
    "totalTokens": 856320,
    "totalCost": 4.23,
    "byService": {
      "benji-chat": { "calls": 890, "tokens": 312000, "cost": 0.15 },
      "nl-shipment": { "calls": 210, "tokens": 261000, "cost": 1.10 },
      "document-ocr": { "calls": 85, "tokens": 161000, "cost": 1.42 },
      "document-extraction": { "calls": 62, "tokens": 122320, "cost": 1.56 }
    },
    "byModel": {
      "gpt-4o-mini": { "calls": 890, "tokens": 312000, "cost": 0.15 },
      "gpt-4o": { "calls": 357, "tokens": 544320, "cost": 4.08 }
    },
    "dailyBreakdown": [
      { "date": "2025-02-01", "calls": 45, "tokens": 32100, "cost": 0.18 },
      { "date": "2025-02-02", "calls": 62, "tokens": 44200, "cost": 0.24 }
    ]
  }
}
```

### Token Tracking Visual

```
  Daily AI Cost ($)
  
  $0.50 ┤
  $0.40 ┤                          ██
  $0.30 ┤              ██    ██    ██
  $0.20 ┤    ██  ██    ██    ██    ██    ██
  $0.10 ┤    ██  ██    ██    ██    ██    ██    ██
  $0.00 ┼────██──██────██────██────██────██────██───
        Mon  Tue Wed  Thu   Fri   Sat   Sun

  ██ Chat (GPT-4o-mini)  ██ Shipments (GPT-4o)  ██ Documents (GPT-4o)
```

---

## Testing Guide

### Test Benji Chat
```bash
curl -X POST http://localhost:3001/api/v1/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "How do I ship my car?"}],
    "context": {"userType": "client", "currentPage": "dashboard"}
  }'
```

Expected response includes `tokenUsage` and `cached` field:
```json
{
  "success": true,
  "message": "I can help you ship your car! ...",
  "confidence": 0.95,
  "suggestions": ["Create shipment now", "Get a quote"],
  "tokenUsage": {
    "promptTokens": 285,
    "completionTokens": 142,
    "totalTokens": 427,
    "estimatedCost": 0.00013,
    "model": "gpt-4o-mini"
  },
  "cached": false
}
```

### Test NL Shipment
```bash
curl -X POST http://localhost:3001/api/v1/ai/natural-language-shipment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Ship my 2023 Honda Civic from Charlotte to Miami next Tuesday"}'
```

### Test Rate Limiting
```bash
# Send 25+ rapid requests to trigger rate limit
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3001/api/v1/ai/chat \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"messages": [{"role": "user", "content": "test"}], "context": {"userType": "client"}}'
done
# Should see 200s then 429s after 20 requests
```

### Test Usage Stats (Admin)
```bash
curl http://localhost:3001/api/v1/ai/usage/summary \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Test Cache Stats (Admin)
```bash
curl http://localhost:3001/api/v1/ai/cache/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## File Index

| File | Purpose |
|------|---------|
| `backend/src/config/ai.config.ts` | Model configs, cost tracking, caching, rate limit settings |
| `backend/src/services/BenjiChatService.ts` | Conversational AI (GPT-4o-mini + cache + tracking) |
| `backend/src/services/NaturalLanguageShipmentService.ts` | NL→Shipment (GPT-4o + tracking) |
| `backend/src/services/AIDocumentExtractionService.ts` | Document OCR + extraction (GPT-4o + tracking) |
| `backend/src/services/BenjiDispatcherService.ts` | Auto-dispatch (algorithmic, no AI) |
| `backend/src/services/BenjiLoadRecommendationService.ts` | Load recommendations (algorithmic, no AI) |
| `backend/src/routes/ai.routes.ts` | All AI endpoints + rate limiting + admin stats |
| `backend/src/middlewares/ai-rate-limit.middleware.ts` | Per-user sliding window rate limiter |
| `website/src/components/benji/BenjiChat/BenjiChat.tsx` | Frontend chat component |
| `website/src/components/benji/BenjiDocumentScanner.tsx` | Document upload UI |
| `website/src/components/driver/BenjiLoadRecommendations.tsx` | Driver load recs UI |
| `website/src/components/admin/BenjiDispatcher.tsx` | Admin dispatcher UI |

---

## Summary of Changes (v2.0)

1. **Tiered Models**: BenjiChat switched from GPT-4o → GPT-4o-mini (95% cost reduction)
2. **Token Tracking**: Every OpenAI call logs prompt/completion tokens, cost, duration, user
3. **Response Cache**: 30-minute in-memory cache for Benji chat (reduces redundant API calls ~40%)
4. **Rate Limiting**: Per-user sliding window with burst protection on all AI endpoints
5. **Admin Endpoints**: 4 new endpoints for usage stats, recent calls, cache stats, cache clear
6. **Centralized Config**: `ai.config.ts` holds all model configs, costs, and projections
7. **Cost Visibility**: Real-time cost tracking per service, per model, per day

> **Result**: ~61% annual cost reduction while maintaining identical functionality and adding abuse protection.
