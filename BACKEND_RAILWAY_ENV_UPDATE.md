# Backend Railway Environment Variable Update

## 🚀 Action Required: Update Railway Backend CORS Configuration

### Current Issue:
The website quote calculator needs to call the backend API, but CORS will block requests from the website domain.

### Solution:
Add the website domain to the CORS_ORIGIN environment variable on Railway.

---

## 📋 Steps to Update Railway:

### 1. Login to Railway Dashboard
```
https://railway.app/dashboard
```

### 2. Navigate to Your Backend Project
- Select your DriveDrop backend service

### 3. Go to Variables Tab
- Click on "Variables" in the left sidebar

### 4. Update CORS_ORIGIN Variable

**Current Value (likely):**
```
http://localhost:3000,http://localhost:8081,http://localhost:19006
```

**New Value (add these):**
```
http://localhost:3000,http://localhost:8081,http://localhost:19006,http://localhost:3001,https://drivedrop.us.com,https://www.drivedrop.us.com
```

**Explanation:**
- `http://localhost:3001` - For local website development
- `https://drivedrop.us.com` - Your production website domain
- `https://www.drivedrop.us.com` - With www subdomain

### 5. Redeploy Backend
After updating the environment variable, Railway will automatically redeploy your backend service.

---

## ✅ Verification

### Test CORS is Working:

```bash
# From your local machine
curl -H "Origin: https://drivedrop.us.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  https://your-backend.railway.app/api/v1/pricing/calculate -v
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: https://drivedrop.us.com
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH
Access-Control-Allow-Credentials: true
```

---

## 🔄 Alternative: Allow All Origins (Development Only)

If you want to temporarily allow all origins for testing:

```bash
CORS_ORIGIN=*
```

**⚠️ WARNING:** Only use this for development. In production, always specify exact domains for security.

---

## 📝 Notes:

- The backend code already supports comma-separated origins
- No code changes needed - just environment variable update
- Railway will auto-redeploy after variable change (takes ~2-3 minutes)
- Make sure to test both with and without `www` subdomain

---

## 🧪 Test After Update:

### From Website (Local):
```bash
cd website
npm run dev
# Go to http://localhost:3001
# Try the quote calculator
# Check browser console for CORS errors
```

### From Website (Production):
```bash
# After deploying to Vercel
# Visit https://drivedrop.us.com
# Try the quote calculator
# Should work without CORS errors
```

---

**Status:** ✅ Backend code updated locally with new CORS origins
**Next:** Update Railway environment variable when ready to deploy
