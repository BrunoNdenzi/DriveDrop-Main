# 🚀 Vercel Deployment Guide - DriveDrop

## ⚠️ IMPORTANT: Root Directory Setting

Your Next.js app is in the `website/` subfolder, not the root!

**In Vercel Dashboard, you MUST set:**
```
Root Directory: ./website
```

Click "Edit" next to Root Directory and change from `./` to `./website`

---

## 📋 Step-by-Step Deployment

### Step 1: Configure Root Directory ✅
1. In Vercel import screen, find "Root Directory"
2. Click "Edit"
3. Change to: `./website`
4. Click "Continue"

### Step 2: Framework Preset ✅
Vercel should auto-detect:
- **Framework:** Next.js
- **Build Command:** `npm run build` or `next build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

**Leave these as default** - they're already correct!

### Step 3: Environment Variables ⚙️

Click "Environment Variables" dropdown and add these:

#### Required Variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tgdewxxmfmbvvcelngeg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Stripe (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

#### Optional Variables:

```bash
# Backend API (if using Railway backend)
NEXT_PUBLIC_API_URL=https://your-backend.railway.app

# Node Environment
NODE_ENV=production
```

**💡 Tip:** Click "Import .env" button and paste contents from your local `.env.local` file!

### Step 4: Deploy! 🚀

Click the big black **"Deploy"** button at the bottom!

Vercel will:
1. ✅ Clone your GitHub repo
2. ✅ Install dependencies (`npm install`)
3. ✅ Build your Next.js app (`npm run build`)
4. ✅ Deploy to global CDN
5. ✅ Give you a live URL!

⏱️ **First deployment takes 2-3 minutes**

---

## 🎯 After Deployment

### You'll Get:

1. **Production URL:** `https://drivedrop-main-[random].vercel.app`
2. **Preview URL:** Every git push creates a new preview
3. **Dashboard:** Monitor performance, logs, analytics

### Test Your Site:

```bash
# Visit these pages:
https://your-url.vercel.app
https://your-url.vercel.app/login
https://your-url.vercel.app/signup
https://your-url.vercel.app/dashboard/client
```

### Configure Stripe Webhooks:

1. Go to Stripe Dashboard → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-url.vercel.app/api/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.amount_capturable_updated`
   - `payment_intent.partially_funded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Copy webhook secret
6. Add to Vercel env vars: `STRIPE_WEBHOOK_SECRET=whsec_...`

---

## 🔧 Build Settings Reference

### Correct Settings:

| Setting | Value |
|---------|-------|
| **Root Directory** | `./website` ⚠️ CRITICAL |
| **Framework** | Next.js |
| **Build Command** | `next build` |
| **Output Directory** | `.next` |
| **Install Command** | `npm install` |
| **Node.js Version** | 20.x |

### ❌ Common Mistakes:

1. **Root Directory = `.`** → ❌ WRONG! Should be `./website`
2. Missing environment variables → Build succeeds but app crashes
3. Using development Stripe keys → Payments fail in production

---

## 📱 Domain Configuration (Optional)

### Add Custom Domain:

1. Go to Project Settings → Domains
2. Click "Add Domain"
3. Enter: `www.drivedrop.com` (or your domain)
4. Vercel provides DNS records
5. Add records to your domain registrar
6. Wait 24-48 hours for DNS propagation

### SSL Certificate:

✅ Vercel automatically provisions SSL certificates (HTTPS)
✅ No configuration needed!

---

## 🔄 Continuous Deployment

### Automatic Deployments:

Every time you push to GitHub:
- ✅ `main` branch → Production deployment
- ✅ Other branches → Preview deployment (unique URL)
- ✅ Pull requests → Preview deployment (attached to PR)

### Manual Redeployment:

```bash
# From Vercel dashboard:
Project → Deployments → Click ⋯ → Redeploy
```

Or use Vercel CLI:
```bash
npm i -g vercel
vercel --prod
```

---

## 🐛 Troubleshooting

### Build Fails:

**Error:** "Cannot find module 'next'"
```bash
Solution: Root directory is wrong!
Set Root Directory to: ./website
```

**Error:** "Environment variable not found"
```bash
Solution: Add missing environment variables
Check: Project Settings → Environment Variables
```

### App Crashes After Deploy:

**Error:** "500 Internal Server Error"
```bash
Check: Vercel Dashboard → Functions tab → View logs
Common causes:
- Missing SUPABASE_SERVICE_ROLE_KEY
- Missing STRIPE_SECRET_KEY
- Wrong API URLs
```

### Payments Not Working:

```bash
Check:
1. Stripe webhook configured with production URL
2. STRIPE_WEBHOOK_SECRET added to env vars
3. Using correct Stripe keys (test vs live)
```

---

## 📊 Monitoring & Analytics

### View Logs:

1. Vercel Dashboard → Project
2. Click "Functions" tab
3. Select a function (e.g., `/api/stripe/create-payment-intent`)
4. View real-time logs

### Performance Metrics:

- **Speed Insights:** Vercel Dashboard → Analytics
- **Web Vitals:** Core Web Vitals automatically tracked
- **Error Tracking:** Vercel Dashboard → Runtime Logs

---

## 🔐 Security Checklist

Before going live:

- [ ] All environment variables added to Vercel
- [ ] `.env` files in `.gitignore` (already done ✅)
- [ ] Stripe webhook secret configured
- [ ] Supabase RLS policies enabled
- [ ] API keys restricted (Google Maps, Stripe)
- [ ] HTTPS enabled (automatic with Vercel ✅)
- [ ] CSP headers configured (already done ✅)

---

## 🎉 Success Indicators

Your deployment is successful when:

✅ Build completes without errors
✅ Can visit homepage at Vercel URL
✅ Can sign up and log in
✅ Can create new shipment
✅ Payment flow works (test mode)
✅ No errors in Vercel function logs

---

## 📞 Need Help?

**Common Issues:**

1. **Build fails immediately** → Check root directory is `./website`
2. **Build succeeds, app crashes** → Check environment variables
3. **Payments fail** → Check Stripe keys and webhook setup
4. **API errors** → Check Supabase service role key

**Check Vercel Docs:**
- [Next.js Deployment](https://vercel.com/docs/frameworks/nextjs)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Custom Domains](https://vercel.com/docs/concepts/projects/domains)

---

## 🚀 Quick Deployment Checklist

```
□ Set Root Directory to ./website
□ Add all environment variables
□ Click Deploy button
□ Wait 2-3 minutes
□ Visit deployed URL
□ Test login/signup
□ Test payment flow
□ Configure Stripe webhook
□ Share URL with team! 🎉
```

---

**Ready to deploy!** 🚀 Just follow the steps above and you'll have a live site in minutes!
