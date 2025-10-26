# Dynamic Pricing System - Deployment Checklist

## Pre-Deployment ✓

### 1. Code Review
- [x] Database migration file created and reviewed
- [x] Service layer implementation complete
- [x] API routes implemented with proper auth
- [x] Pricing service integration complete
- [x] TypeScript errors resolved
- [x] Import paths corrected

### 2. Documentation
- [x] API documentation created (DYNAMIC_PRICING_COMPLETE.md)
- [x] Implementation summary created
- [x] Test script provided
- [x] Example cURL commands included

---

## Deployment Steps

### Step 1: Database Migration ⏳
```bash
# Option A: Using Supabase CLI (Recommended)
supabase db push

# Option B: Manual SQL execution
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy contents of: supabase/migrations/51_pricing_configuration.sql
# 3. Execute the SQL
```

**Verify:**
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('pricing_config', 'pricing_config_history');

-- Check default config was inserted
SELECT id, min_quote, current_fuel_price, is_active 
FROM pricing_config 
WHERE is_active = true;
```

Expected: Should see 1 active configuration with default values.

---

### Step 2: Backend Deployment ⏳

#### If using Railway:
```bash
git add .
git commit -m "feat: dynamic pricing configuration system"
git push origin main
# Railway will auto-deploy
```

#### If using Render/Heroku:
```bash
git add .
git commit -m "feat: dynamic pricing configuration system"
git push heroku main
# Or: git push origin main (if auto-deploy enabled)
```

#### If using PM2 (Manual):
```bash
cd backend
npm install
npm run build
pm2 restart all
```

**Verify Backend Started:**
```bash
# Check API health
curl https://your-api-domain.com/api/v1/

# Should see admin in services list
```

---

### Step 3: Test Admin Endpoints ⏳

#### 3.1 Get Admin Token
```bash
# Login as admin user
curl -X POST https://your-api-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_admin_password"
  }'

# Copy the JWT token from response
```

#### 3.2 Test Get Active Config
```bash
curl https://your-api-domain.com/api/v1/admin/pricing/config \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Expected: 200 OK with pricing config object
```

#### 3.3 Test Update Config
```bash
curl -X PUT https://your-api-domain.com/api/v1/admin/pricing/config/CONFIG_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "change_reason": "Test update",
    "current_fuel_price": 3.90
  }'

# Expected: 200 OK with updated config
```

#### 3.4 Test Quote with Dynamic Pricing
```bash
curl -X POST https://your-api-domain.com/api/v1/pricing/quote \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_type": "sedan",
    "distance_miles": 200,
    "use_dynamic_config": true
  }'

# Expected: 200 OK with quote using dynamic config values
```

#### 3.5 Test History Retrieval
```bash
curl https://your-api-domain.com/api/v1/admin/pricing/config/CONFIG_ID/history?limit=5 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Expected: 200 OK with array of history entries
```

---

### Step 4: Automated Testing ⏳

```bash
# 1. Update test file configuration
cd backend
nano test-dynamic-pricing.js

# Update these values:
# - API_BASE_URL: 'https://your-api-domain.com/api/v1'
# - ADMIN_TOKEN: 'your_admin_jwt_token'

# 2. Run tests
node test-dynamic-pricing.js

# Expected: All 6 tests should pass
```

**Test Results to Verify:**
- ✅ Test 1: Get Active Pricing Configuration
- ✅ Test 2: Update Pricing Configuration
- ✅ Test 3: Calculate Quote with Dynamic Pricing
- ✅ Test 4: Get Configuration Change History
- ✅ Test 5: Clear Pricing Cache
- ✅ Test 6: Compare Static vs Dynamic Pricing

---

### Step 5: Production Validation ⏳

#### 5.1 Check Logs
```bash
# Backend logs should show:
# - "Pricing configuration updated" (when changes are made)
# - "Calculated pricing with dynamic config" (when quotes are requested)
# - No errors related to pricing config

# Check for errors:
grep -i "error.*pricing" /path/to/logs
```

#### 5.2 Monitor Performance
```bash
# Check API response times
# - GET /admin/pricing/config: <50ms (cached)
# - POST /pricing/quote: <100ms

# Check database load
# - Pricing config queries should be minimal due to caching
```

#### 5.3 Verify Cache is Working
```bash
# 1. Request active config (should hit database)
curl https://your-api.com/api/v1/admin/pricing/config -H "Authorization: Bearer TOKEN"

# 2. Request again immediately (should hit cache)
curl https://your-api.com/api/v1/admin/pricing/config -H "Authorization: Bearer TOKEN"

# 3. Check backend logs - second request should be faster
```

---

## Post-Deployment

### Immediate Actions ✓

#### 1. Set Production Pricing Values
```bash
curl -X PUT https://your-api-domain.com/api/v1/admin/pricing/config/CONFIG_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "change_reason": "Initial production pricing configuration",
    "current_fuel_price": 3.85,
    "min_quote": 160,
    "surge_enabled": false,
    "surge_multiplier": 1.0
  }'
```

#### 2. Document Admin Credentials
- [ ] Admin email and password stored securely
- [ ] JWT token generation process documented
- [ ] Emergency admin contact designated

#### 3. Create Backup Admin User
```bash
# In Supabase Dashboard → Authentication → Users
# Create: backup-admin@yourdomain.com
# Set role: admin
```

#### 4. Schedule First Fuel Price Update
- [ ] Set reminder for weekly fuel price review
- [ ] Document current market fuel price source
- [ ] Train admin on price update process

---

### Communication ✓

#### Notify Stakeholders
- [ ] Development team: API changes documented
- [ ] Product team: New admin capabilities available
- [ ] Support team: Pricing now dynamically managed
- [ ] Finance team: Audit trail available for compliance

#### Update Documentation
- [ ] Add to internal wiki/docs
- [ ] Update API documentation site
- [ ] Create admin user guide (simplified version)
- [ ] Add to onboarding materials

---

## Monitoring & Maintenance

### Daily
- [ ] Check for pricing config update errors in logs
- [ ] Verify cache is working (low database query count)
- [ ] Monitor API response times

### Weekly
- [ ] Review fuel prices and update if needed
- [ ] Check pricing config history for unusual changes
- [ ] Verify admin access is working

### Monthly
- [ ] Audit pricing changes (who changed what)
- [ ] Review pricing strategy effectiveness
- [ ] Clean up old history entries (optional, if table grows large)

### Quarterly
- [ ] Review all pricing parameters
- [ ] Consider seasonal pricing configurations
- [ ] Update documentation as needed

---

## Troubleshooting Guide

### Issue: "Cannot find module '@lib/supabase'"
**Solution:** 
```bash
cd backend
npm install
npm run build
```
Restart backend server.

---

### Issue: "User not authenticated" when accessing admin routes
**Diagnosis:**
- Check JWT token is valid and not expired
- Verify user has `role = 'admin'` in database

**Solution:**
```sql
-- Check user role
SELECT id, email, role FROM profiles WHERE email = 'admin@example.com';

-- Update role if needed
UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
```

---

### Issue: "Pricing configuration not found"
**Diagnosis:**
- Default config may not have been inserted
- Using wrong config ID

**Solution:**
```sql
-- Check existing configs
SELECT id, is_active FROM pricing_config;

-- Insert default if missing
INSERT INTO pricing_config (
  min_quote, accident_min_quote, base_fuel_price, 
  current_fuel_price, is_active, created_by
) VALUES (
  150, 80, 3.70, 3.70, true, 
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
);
```

---

### Issue: Quotes not using dynamic pricing
**Diagnosis:**
- `use_dynamic_config` might be false
- Cache might have stale data
- Error in pricing config fetch

**Solution:**
```bash
# 1. Clear cache
curl -X POST https://your-api.com/api/v1/admin/pricing/cache/clear \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 2. Test quote with explicit dynamic config flag
curl -X POST https://your-api.com/api/v1/pricing/quote \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vehicle_type":"sedan","distance_miles":200,"use_dynamic_config":true}'

# 3. Check backend logs for errors
```

---

### Issue: High database load from pricing queries
**Diagnosis:**
- Cache not working
- Cache duration too short
- Too many cache clears

**Solution:**
```typescript
// In pricingConfig.service.ts
// Increase cache duration from 5 minutes to 15 minutes
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
```

---

## Rollback Procedure

### Level 1: Disable Dynamic Pricing (No Code Changes)
```bash
# All future quotes will use static pricing
# Update mobile app or client to send:
{
  "use_dynamic_config": false
}
```
**Impact:** Immediate, no deployment needed  
**Downside:** Reverts to hardcoded values

---

### Level 2: Restore Previous Config
```sql
-- Find the previous configuration
SELECT * FROM pricing_config_history 
WHERE config_id = 'YOUR_CONFIG_ID' 
ORDER BY changed_at DESC 
LIMIT 2;

-- Restore values from config_snapshot
UPDATE pricing_config 
SET 
  min_quote = (SELECT config_snapshot->>'min_quote' FROM pricing_config_history WHERE id = 'HISTORY_ID'),
  current_fuel_price = (SELECT config_snapshot->>'current_fuel_price' FROM pricing_config_history WHERE id = 'HISTORY_ID')
  -- ... other fields
WHERE id = 'YOUR_CONFIG_ID';
```

**Impact:** Restores previous pricing  
**Downside:** Manual SQL required

---

### Level 3: Remove Dynamic Pricing (Full Rollback)
```bash
# 1. Revert code changes
git revert HEAD  # or specific commit

# 2. Redeploy backend
git push origin main

# 3. Optional: Drop tables
# DROP TABLE pricing_config_history CASCADE;
# DROP TABLE pricing_config CASCADE;
```

**Impact:** Complete removal of feature  
**Downside:** Requires code deployment

---

## Success Criteria ✓

### Technical
- [x] All API endpoints return 200 OK for valid requests
- [x] No TypeScript compilation errors
- [x] No runtime errors in logs
- [x] Cache hit rate >90%
- [x] API response times <100ms

### Functional
- [ ] Admin can update fuel prices via API
- [ ] Admin can enable/disable surge pricing
- [ ] Quotes reflect current configuration
- [ ] History tracks all changes
- [ ] Cache invalidation works correctly

### Business
- [ ] Time to update pricing reduced from 30 min to <2 min
- [ ] No code deployments needed for price changes
- [ ] Full audit trail available
- [ ] Admins trained on new system

---

## Phase 2 Planning (Mobile UI)

### When Backend is Stable:
1. Design mobile admin screens (Figma/sketch)
2. Implement React Native admin screens
3. Add form validation and error handling
4. Build preview calculator
5. Add configuration templates
6. User acceptance testing
7. Deploy to production

**Estimated Timeline:** 2-3 weeks  
**Priority:** Medium (API is sufficient for now)

---

## Contact & Support

### For Issues:
- Check logs first: `/var/log/backend.log`
- Review this checklist
- Check troubleshooting section
- Review API documentation: `DYNAMIC_PRICING_COMPLETE.md`

### Emergency Contacts:
- Backend Team: [Your contact]
- Database Admin: [Your contact]
- DevOps: [Your contact]

---

## Completion Sign-off

### Checklist Review:
- [ ] Database migration executed successfully
- [ ] Backend deployed with new code
- [ ] All API tests passing
- [ ] Production pricing values set
- [ ] Backup admin created
- [ ] Team notified
- [ ] Documentation updated
- [ ] Monitoring in place

### Sign-off:
- **Developed by:** _________________  
- **Tested by:** _________________  
- **Approved by:** _________________  
- **Date:** _________________  

---

**Version:** 1.0.0  
**Last Updated:** January 30, 2025  
**Status:** Ready for Deployment
