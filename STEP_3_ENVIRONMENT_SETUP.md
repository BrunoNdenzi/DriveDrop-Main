# Step-by-Step Environment Setup

## ✅ Step 3: Environment Variables Setup

You need TWO Google Maps API keys:

### 1. Client-side key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
- Used for: Maps JavaScript API (displaying maps in browser)
- Already in your .env.local.example
- Restrictions: HTTP referrer (your website domains)

### 2. Server-side key (GOOGLE_MAPS_API_KEY)
- Used for: Geocoding API, Distance Matrix API (server-side calls)
- Need to add to .env.local
- Restrictions: None or IP-based (more secure)

### Update your website/.env.local file:

```env
# Existing variables
NEXT_PUBLIC_API_URL=https://your-app.up.railway.app/api/v1
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Maps - Client Side (for map display)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Google Maps - Server Side (for geocoding) - ADD THIS LINE
GOOGLE_MAPS_API_KEY=your-google-maps-server-api-key

# Other keys...
CHECKR_API_KEY=your-checkr-api-key
```

### Enable Required APIs in Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/library
2. Enable these APIs:
   - ✅ Maps JavaScript API (already enabled)
   - ⚠️ **Geocoding API** (REQUIRED - enable this)
   - ✅ Distance Matrix API (already enabled)
   - Geocoding API endpoint: Enable at https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com

### API Key Restrictions (Recommended):

**Client-side key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY):**
- Application restrictions: HTTP referrers
- Add: 
  - `localhost:3000/*` (for development)
  - `yourdomain.com/*` (for production)
  - `*.yourdomain.com/*` (for subdomains)
- API restrictions: Enable only:
  - Maps JavaScript API
  - Places API

**Server-side key (GOOGLE_MAPS_API_KEY):**
- Application restrictions: None (or IP addresses if you have static IPs)
- API restrictions: Enable only:
  - Geocoding API
  - Distance Matrix API

---

## ⚠️ ACTION REQUIRED:

1. Copy your `website/.env.local.example` to `website/.env.local`
2. Add the line: `GOOGLE_MAPS_API_KEY=your-api-key`
3. Enable Geocoding API in Google Cloud Console
4. Test the geocoding endpoint (instructions in next step)
