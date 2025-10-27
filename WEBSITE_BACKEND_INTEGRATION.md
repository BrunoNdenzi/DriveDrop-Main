# Website Backend Integration - Complete! ✅

## 🎉 Summary

Successfully integrated the DriveDrop website with the backend pricing API!

---

## ✅ Changes Made

### 1. Backend API - New Public Endpoint
**File:** `backend/src/routes/pricing.routes.ts`

**Added:** `/api/v1/pricing/calculate` (public, no auth required)

```typescript
POST /api/v1/pricing/calculate
Body: {
  "vehicle_type": "sedan" | "suv" | "pickup" | "luxury" | "motorcycle" | "heavy",
  "distance_miles": 500,
  "pickup_date": "2025-01-27T10:00:00Z", // optional
  "delivery_date": "2025-01-29T10:00:00Z", // optional  
  "is_accident_recovery": false, // optional
  "vehicle_count": 1 // optional
}

Response: {
  "success": true,
  "data": {
    "total": 450.50, // in dollars
    "breakdown": {
      "baseRatePerMile": 0.95,
      "distanceBand": "short",
      "rawBasePrice": 475.00,
      "operatingCostPerMile": 0.68,
      "operatingCostTotal": 340.00,
      "profitMarginPercent": 30,
      "profitAmount": 102.00,
      "deliveryType": "standard",
      "deliveryTypeMultiplier": 1.0,
      "minimumApplied": false
    }
  }
}
```

### 2. Backend CORS Configuration
**File:** `backend/.env`

**Updated:** Added website domains to CORS_ORIGIN
```bash
CORS_ORIGIN=http://localhost:3000,http://localhost:8081,http://localhost:19006,http://192.168.1.66:3000,http://192.168.1.66:8081,http://192.168.1.66:19006,http://localhost:3001,https://drivedrop.us.com,https://www.drivedrop.us.com
```

**Includes:**
- `http://localhost:3001` - Local website development
- `https://drivedrop.us.com` - Production website
- `https://www.drivedrop.us.com` - Production website with www

### 3. Website API Route - Backend Integration
**File:** `website/src/app/api/quotes/calculate/route.ts`

**Changed:** From mock pricing to real backend API calls

**Features:**
- Calls backend `/api/v1/pricing/calculate`
- Maps website vehicle types to backend format
- Handles shipping speed (express vs standard)
- Returns formatted quote with breakdown

### 4. Website Environment Variables
**File:** `website/.env.local`

**Added:** `NEXT_PUBLIC_BACKEND_URL`
```bash
NEXT_PUBLIC_BACKEND_URL=https://drivedrop-main-production.up.railway.app
```

---

## 🧪 Testing

### Local Testing (Backend + Website)

#### 1. Start Backend:
```bash
cd backend
npm run dev
# Backend runs on http://localhost:3000
```

#### 2. Start Website:
```bash
cd website
npm run dev
# Website runs on http://localhost:3001
```

#### 3. Test Quote Calculator:
```bash
# Open browser
http://localhost:3001

# Fill out quote form:
- Pickup: "Los Angeles, CA"
- Delivery: "New York, NY"  
- Vehicle: Sedan
- Speed: Standard

# Click "Get Quote"
```

#### 4. Expected Result:
- Quote displays with price (e.g., $950.00)
- Distance shown (e.g., ~2,800 miles)
- Breakdown visible
- No CORS errors in console

### Test Backend Endpoint Directly:
```bash
curl -X POST http://localhost:3000/api/v1/pricing/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_type": "sedan",
    "distance_miles": 2800,
    "pickup_date": "2025-01-27T10:00:00Z",
    "delivery_date": "2025-02-01T10:00:00Z"
  }'
```

---

## 🚀 Production Deployment

### Step 1: Update Railway Backend
1. Login to Railway dashboard
2. Navigate to backend service
3. Go to Variables tab
4. Update `CORS_ORIGIN` to include:
   ```
   https://drivedrop.us.com,https://www.drivedrop.us.com
   ```
5. Railway will auto-redeploy (takes ~2-3 min)

### Step 2: Deploy Website to Vercel
```bash
cd website
npm run build  # Test build locally first

# Deploy to Vercel
vercel --prod

# Or push to GitHub and let Vercel auto-deploy
```

### Step 3: Configure Custom Domain
1. Login to Vercel dashboard
2. Go to project settings
3. Add domain: `drivedrop.us.com`
4. Add DNS records in Porkbun:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21 (Vercel's IP)
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

### Step 4: Test Production
```bash
# Visit website
https://drivedrop.us.com

# Test quote calculator
# Check browser console for errors
# Verify backend API is called
```

---

## 🐛 Troubleshooting

### Quote Calculator Not Working

**Issue:** CORS error in browser console
```
Access to fetch at 'https://drivedrop-main-production.up.railway.app/api/v1/pricing/calculate'
from origin 'https://drivedrop.us.com' has been blocked by CORS policy
```

**Solution:** 
1. Check Railway environment variable `CORS_ORIGIN` includes your domain
2. Restart Railway service if needed
3. Clear browser cache

**Issue:** 404 Not Found on `/api/v1/pricing/calculate`
```
{ "error": "Not Found" }
```

**Solution:**
1. Verify backend is deployed with latest code
2. Check `pricing.routes.ts` has the `/calculate` endpoint
3. Restart backend service

**Issue:** Backend timeout or slow response

**Solution:**
1. Check Railway service logs
2. Verify Supabase connection
3. Test backend endpoint directly with curl

### Website Build Errors

**Issue:** `NEXT_PUBLIC_BACKEND_URL is not defined`

**Solution:**
```bash
# Add to website/.env.local
NEXT_PUBLIC_BACKEND_URL=https://drivedrop-main-production.up.railway.app

# Restart dev server
npm run dev
```

**Issue:** TypeScript errors in route.ts

**Solution:**
```bash
cd website
npm run type-check
# Fix any type errors shown
```

---

## 📊 API Response Format

### Backend Response (from `/api/v1/pricing/calculate`):
```json
{
  "success": true,
  "data": {
    "total": 950.50,
    "breakdown": {
      "baseRatePerMile": 0.60,
      "distanceBand": "long",
      "rawBasePrice": 1680.00,
      "accidentRecoveryFee": null,
      "bulkDiscountPercent": 0,
      "bulkDiscountAmount": 0,
      "costComponentsPerMile": {
        "fuel": 0.525,
        "driver": 0.625,
        "insurance": 0.15,
        "maintenance": 0.275,
        "tolls": 0.10
      },
      "operatingCostPerMile": 1.675,
      "operatingCostTotal": 4690.00,
      "profitMarginPercent": 30,
      "profitAmount": 1407.00,
      "surgeMultiplier": 1.0,
      "deliveryTypeMultiplier": 1.0,
      "deliveryType": "standard",
      "fuelPricePerGallon": 3.70,
      "fuelAdjustmentPercent": 0,
      "minimumApplied": false,
      "total": 950.50
    }
  }
}
```

### Website Response (to frontend):
```json
{
  "totalPrice": 95050,
  "distance": 2800,
  "estimatedDays": 5,
  "breakdown": {
    "basePrice": 168000,
    "fuelSurcharge": 469000,
    "vehicleSurcharge": 0,
    "speedSurcharge": 0
  },
  "backendBreakdown": { /* full backend breakdown for debugging */ }
}
```

---

## ✅ Verification Checklist

- [x] Backend endpoint `/api/v1/pricing/calculate` created
- [x] Backend CORS updated to include website domains
- [x] Website API route updated to call backend
- [x] Website environment variables configured
- [ ] Local testing complete (backend + website running)
- [ ] Railway CORS environment variable updated
- [ ] Website deployed to Vercel
- [ ] Custom domain configured (drivedrop.us.com)
- [ ] Production testing complete

---

## 🎯 Next Steps

1. **Test Locally:** Start both backend and website, test quote calculator
2. **Update Railway:** Add website domains to CORS_ORIGIN
3. **Deploy Website:** Push to Vercel with custom domain
4. **Monitor:** Check logs for errors, test from different browsers/devices

---

**Status:** ✅ Backend integration complete, ready for testing!
**Last Updated:** January 27, 2025
