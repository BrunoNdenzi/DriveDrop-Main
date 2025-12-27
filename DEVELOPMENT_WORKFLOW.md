# 🚀 Development Workflow - Commercial Expansion Implementation

**Date:** December 27, 2025  
**Branch:** `feature/commercial-expansion`  
**Status:** Ready to Start

---

## 🎯 **Development Strategy**

### **The Challenge:**
- Major changes across backend, frontend, database
- Backend deployed on Railway
- Frontend deployed on Vercel
- Need to test everything before production deployment
- Can't break production during development

### **The Solution:**
**Feature Branch + Staging Environment**

```
┌─────────────────────────────────────────────────────┐
│               DEVELOPMENT FLOW                       │
└─────────────────────────────────────────────────────┘

Step 1: Create Feature Branch
    git checkout -b feature/commercial-expansion

Step 2: Develop Locally
    ├─ Code changes
    ├─ Test with local Supabase
    ├─ Test backend with Postman
    └─ Test frontend at localhost:3000

Step 3: Push to Feature Branch
    git push origin feature/commercial-expansion

Step 4: Railway Staging Deployment
    ├─ Railway auto-deploys feature branch
    ├─ Separate URL: https://drivedrop-staging.railway.app
    ├─ Test backend APIs
    └─ Connect to staging Supabase

Step 5: Vercel Preview Deployment
    ├─ Create PR: feature/commercial-expansion → main
    ├─ Vercel auto-creates preview deployment
    ├─ Preview URL: https://drivedrop-preview-xyz.vercel.app
    ├─ Test frontend
    └─ Frontend connects to Railway staging backend

Step 6: Integration Testing
    ├─ Test complete flows
    ├─ Fix bugs on feature branch
    ├─ Repeat steps 2-5 until perfect
    └─ Get team approval

Step 7: Production Deployment
    ├─ Merge PR to main
    ├─ Railway deploys to production
    ├─ Vercel deploys to production
    └─ Monitor for issues
```

---

## 📁 **Project Structure**

```
DriveDrop-Main/
├── backend/                         # Railway deployment
│   ├── src/
│   │   ├── services/               # Business logic
│   │   │   ├── universalIntegrationService.ts    # NEW ⭐
│   │   │   ├── commercialAccountService.ts       # NEW ⭐
│   │   │   ├── bolService.ts                     # NEW ⭐
│   │   │   ├── gatePassService.ts                # NEW ⭐
│   │   │   ├── aiDocumentService.ts              # NEW ⭐
│   │   │   ├── naturalLanguageService.ts         # NEW ⭐
│   │   │   ├── aiDispatcherService.ts            # NEW ⭐
│   │   │   ├── shipmentService.ts                # UPDATE
│   │   │   ├── pricingService.ts                 # UPDATE
│   │   │   └── ... (existing services)
│   │   │
│   │   ├── routes/                 # API endpoints
│   │   │   ├── integrations.ts                   # NEW ⭐
│   │   │   ├── commercial.ts                     # NEW ⭐
│   │   │   ├── bol.ts                            # NEW ⭐
│   │   │   ├── ai.ts                             # NEW ⭐
│   │   │   ├── shipments.ts                      # UPDATE
│   │   │   └── ... (existing routes)
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts                           # UPDATE (API key auth)
│   │   │   ├── rateLimiter.ts                    # NEW ⭐
│   │   │   └── ... (existing middleware)
│   │   │
│   │   └── utils/
│   │       ├── fieldMapper.ts                    # NEW ⭐
│   │       ├── vinValidator.ts                   # NEW ⭐
│   │       ├── qrGenerator.ts                    # NEW ⭐
│   │       └── ... (existing utils)
│   │
│   ├── supabase/migrations/         # Database changes
│   │   ├── 20251227_universal_integration.sql    # NEW ⭐
│   │   ├── 20251227_commercial_tables.sql        # NEW ⭐
│   │   ├── 20251227_ai_tables.sql                # NEW ⭐
│   │   └── ... (existing migrations)
│   │
│   └── package.json
│
├── website/                         # Vercel deployment
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── integrations/            # NEW ⭐
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   ├── add/
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   ├── ai-dispatcher/           # NEW ⭐
│   │   │   │   │   ├── commercial/              # NEW ⭐
│   │   │   │   │   └── ... (existing)
│   │   │   │   │
│   │   │   │   ├── broker/
│   │   │   │   │   ├── shipments/
│   │   │   │   │   │   └── bulk-upload/        # UPDATE
│   │   │   │   │   ├── integrations/           # NEW ⭐
│   │   │   │   │   └── ... (existing)
│   │   │   │   │
│   │   │   │   └── commercial/                  # NEW ⭐
│   │   │   │       ├── page.tsx
│   │   │   │       ├── fleet/
│   │   │   │       └── upload/
│   │   │   │
│   │   │   └── api/
│   │   │       └── v2/                          # NEW API VERSION
│   │   │           └── commercial/
│   │   │
│   │   ├── components/
│   │   │   ├── integrations/                    # NEW ⭐
│   │   │   ├── ai-dispatcher/                   # NEW ⭐
│   │   │   ├── commercial/                      # NEW ⭐
│   │   │   └── ... (existing)
│   │   │
│   │   ├── services/
│   │   │   ├── integrationService.ts            # NEW ⭐
│   │   │   ├── commercialService.ts             # NEW ⭐
│   │   │   ├── aiService.ts                     # NEW ⭐
│   │   │   └── ... (existing)
│   │   │
│   │   └── types/
│   │       ├── integration.ts                   # NEW ⭐
│   │       ├── commercial.ts                    # NEW ⭐
│   │       └── ... (existing)
│   │
│   └── package.json
│
├── mobile/                          # React Native app
│   ├── src/
│   │   ├── screens/
│   │   │   └── BOLSignature/                    # NEW ⭐
│   │   └── services/
│   │       └── bolService.ts                    # NEW ⭐
│   │
│   └── package.json
│
├── docs/                            # Documentation
│   ├── API_REFERENCE.md                         # NEW ⭐
│   ├── INTEGRATION_GUIDE.md                     # NEW ⭐
│   └── ... (existing)
│
└── DEVELOPMENT_WORKFLOW.md          # THIS FILE
```

---

## ⚙️ **Environment Setup**

### **1. Railway Configuration**

**Production (main branch):**
```
URL: https://drivedrop-production.railway.app
Environment: production
Supabase: production database
```

**Staging (feature branch):**
```
URL: https://drivedrop-staging.railway.app
Environment: staging
Supabase: staging database (separate)
```

**Railway Setup:**
1. Go to Railway dashboard
2. Click on your project
3. Settings → Enable "Branch Deployments"
4. Each branch gets its own deployment
5. Set environment variables per environment

### **2. Environment Variables**

Create `.env.local` for local development:

```bash
# ===== EXISTING =====
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
STRIPE_SECRET_KEY=your-stripe-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# ===== NEW FOR COMMERCIAL =====

# Google Cloud Vision (OCR)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_VISION_API_KEY=your-api-key
# OR AWS Textract
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# OpenAI (AI Features)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Integration Credentials (examples - stored encrypted in DB)
# These are for testing only
COPART_API_KEY=test-key
MANHEIM_CLIENT_ID=test-id
MANHEIM_CLIENT_SECRET=test-secret

# Feature Flags (for gradual rollout)
ENABLE_COMMERCIAL_FEATURES=true
ENABLE_AI_DISPATCHER=true
ENABLE_NATURAL_LANGUAGE=true
ENABLE_UNIVERSAL_INTEGRATIONS=true

# Queue System
REDIS_URL=redis://localhost:6379  # For job queues

# Webhooks
WEBHOOK_SECRET=your-webhook-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### **3. Supabase Setup**

**Option A: Cloud (Recommended)**
```bash
# Production database (DON'T TOUCH)
Production URL: https://your-prod.supabase.co

# Staging database (CREATE NEW)
Staging URL: https://your-staging.supabase.co

# Apply migrations to staging first
supabase db push --project-ref your-staging-ref
```

**Option B: Local Development**
```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Apply migrations
supabase db push

# Local URL: http://localhost:54321
```

---

## 🔧 **Development Workflow - Step by Step**

### **Step 1: Initial Setup (5 minutes)**

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/commercial-expansion

# 3. Install any new dependencies (we'll add as we go)
cd backend
npm install

cd ../website
npm install

# 4. Start local development
# Terminal 1: Backend
cd backend
npm run dev  # Runs on http://localhost:5000

# Terminal 2: Frontend
cd website
npm run dev  # Runs on http://localhost:3000

# 5. Test that existing features still work
# Open http://localhost:3000
# Try creating a residential shipment
```

### **Step 2: Database Migrations (Track 1 - Start Here)**

```bash
# Create migration files in backend/supabase/migrations/

# File 1: Universal Integration System
# backend/supabase/migrations/20251227000001_universal_integration.sql

# File 2: Commercial Tables
# backend/supabase/migrations/20251227000002_commercial_tables.sql

# File 3: AI Tables
# backend/supabase/migrations/20251227000003_ai_tables.sql

# Apply to local/staging
supabase db push

# Verify tables created
supabase db dump --data-only
```

### **Step 3: Backend Development (Service Layer)**

**Order of Implementation:**

1. **UniversalIntegrationService** (Most Important)
   ```typescript
   // backend/src/services/universalIntegrationService.ts
   - fetchVehicles(integrationId)
   - testConnection(config)
   - syncIntegration(integrationId)
   - mapFields(rawData, mapping)
   ```

2. **CommercialAccountService**
   ```typescript
   // backend/src/services/commercialAccountService.ts
   - createAccount(data)
   - generateAPIKey(accountId)
   - validateAPIKey(apiKey)
   - setupWebhook(accountId, url)
   ```

3. **BOLService**
   ```typescript
   // backend/src/services/bolService.ts
   - generateBOL(shipmentId)
   - generateBulkBOLs(shipmentIds)
   - getBOLPDF(bolId)
   - addSignature(bolId, signature)
   ```

4. **Continue with remaining services...**

### **Step 4: Backend Routes**

```typescript
// backend/src/routes/integrations.ts

// CRUD
POST   /api/integrations              // Create integration
GET    /api/integrations              // List all
GET    /api/integrations/:id          // Get one
PATCH  /api/integrations/:id          // Update
DELETE /api/integrations/:id          // Delete

// Actions
POST   /api/integrations/:id/test     // Test connection
POST   /api/integrations/:id/sync     // Trigger sync
GET    /api/integrations/:id/logs     // Get logs
GET    /api/integrations/:id/health   // Health status
```

### **Step 5: Frontend Development**

**Start with Admin Integration UI:**
```bash
# Create pages
website/src/app/dashboard/admin/integrations/page.tsx
website/src/app/dashboard/admin/integrations/add/page.tsx
website/src/app/dashboard/admin/integrations/[id]/page.tsx

# Create components
website/src/components/integrations/IntegrationList.tsx
website/src/components/integrations/AddIntegrationForm.tsx
website/src/components/integrations/FieldMapper.tsx
website/src/components/integrations/HealthMonitor.tsx
```

### **Step 6: Testing Each Feature**

```bash
# After implementing each service:

# 1. Unit Tests
npm test services/universalIntegrationService.test.ts

# 2. API Tests (Postman/Thunder Client)
POST http://localhost:5000/api/integrations
{
  "company_name": "Test Auction",
  "integration_type": "api",
  ...
}

# 3. Frontend Tests
npm run test:e2e

# 4. Manual Testing
# - Open localhost:3000
# - Navigate to feature
# - Test complete flow
```

### **Step 7: Push to Feature Branch**

```bash
# After each major feature completion:

git add .
git commit -m "feat: implement universal integration service"
git push origin feature/commercial-expansion

# Railway will auto-deploy to staging
# Check: https://drivedrop-staging.railway.app
```

### **Step 8: Create Pull Request**

```bash
# When ready for team review:

# 1. Push all changes
git push origin feature/commercial-expansion

# 2. Create PR on GitHub
# Title: "Commercial Expansion - Universal Integration, AI Features"
# Description: [List of changes]

# 3. Vercel creates preview deployment
# Preview URL: https://drivedrop-pr-123.vercel.app

# 4. Test preview + staging backend

# 5. Get team approval
```

### **Step 9: Merge to Production**

```bash
# After approval:

# 1. Merge PR on GitHub
git checkout main
git pull origin main

# 2. Railway deploys to production automatically
# 3. Vercel deploys to production automatically

# 4. Run production migrations
supabase db push --project-ref production-ref

# 5. Monitor for issues
# - Check error logs
# - Monitor Railway logs
# - Monitor Vercel logs
# - Test critical flows
```

---

## 🐛 **Debugging & Troubleshooting**

### **Common Issues:**

**1. Database Migration Fails**
```bash
# Rollback
supabase db reset

# Check for errors
supabase db lint

# Apply one by one
supabase db push --file migrations/20251227000001_universal_integration.sql
```

**2. Railway Deployment Fails**
```bash
# Check Railway logs
railway logs --tail

# Common causes:
# - Missing environment variables
# - Build errors
# - Port conflicts

# Fix: Update railway.json or environment
```

**3. API Returns 500 Error**
```bash
# Check backend logs
railway logs --service backend

# Check Supabase logs
# Dashboard → Logs → API Logs

# Add more logging
console.error('Error details:', error);
```

**4. Frontend Can't Connect to Backend**
```bash
# Check CORS settings
# backend/src/index.ts
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

# Check environment variable
echo $NEXT_PUBLIC_API_URL
```

---

## 📊 **Progress Tracking**

### **Implementation Checklist:**

**Week 1: Universal Integration System**
- [ ] Database migrations
- [ ] UniversalIntegrationService
- [ ] Integration routes
- [ ] Admin UI
- [ ] Test with mock data

**Week 2: Commercial Infrastructure**
- [ ] Commercial tables
- [ ] BOL service
- [ ] Gate pass service
- [ ] Commercial account signup
- [ ] Bulk upload enhancement

**Week 3: AI Features - Phase 1**
- [ ] AI document processing
- [ ] Natural language service
- [ ] Frontend interfaces

**Week 4: AI Features - Phase 2**
- [ ] AI Dispatcher service
- [ ] AI Dispatcher dashboard
- [ ] Integration testing

**Week 5: Testing & Documentation**
- [ ] End-to-end tests
- [ ] API documentation
- [ ] User guides

**Week 6: Production Deployment**
- [ ] Final testing
- [ ] Merge to main
- [ ] Deploy to production
- [ ] Monitor & fix issues

---

## 🚦 **Quality Gates**

Before merging to production, ensure:

✅ **Code Quality**
- [ ] All TypeScript errors resolved
- [ ] No console.errors in production
- [ ] Code reviewed by team
- [ ] Follows existing code style

✅ **Testing**
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] End-to-end tests pass
- [ ] Manual testing complete

✅ **Performance**
- [ ] Page load time <3s
- [ ] API response time <500ms
- [ ] Database queries optimized
- [ ] No N+1 queries

✅ **Security**
- [ ] API keys encrypted
- [ ] Rate limiting enabled
- [ ] Input validation
- [ ] SQL injection prevention
- [ ] XSS prevention

✅ **Documentation**
- [ ] API docs complete
- [ ] User guides written
- [ ] Code comments added
- [ ] README updated

✅ **Deployment**
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Rollback plan ready
- [ ] Team notified

---

## 📞 **Need Help?**

**Development Issues:**
- Check Railway logs: `railway logs`
- Check Supabase logs: Dashboard → Logs
- Check browser console: F12 → Console

**Questions:**
- Review this document
- Check TODO list (24 tasks)
- Review architecture docs

---

## 🎯 **Ready to Start?**

Current Status: ✅ **READY**

Next Action: **Start with Task #1 - Setup Development Environment**

Let's build! 🚀
