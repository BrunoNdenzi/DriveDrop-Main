# DriveDrop Website

Modern, responsive website for DriveDrop vehicle shipping platform built with Next.js 14, TypeScript, and Tailwind CSS.

## 🚀 Features

- **Landing Page** with hero section and trust indicators
- **Quote Calculator** for instant shipping estimates
- **Driver Registration** system with multi-step form
- **Mobile App Integration** with deep links
- **Responsive Design** works on all devices
- **SEO Optimized** for better search visibility
- **Type-Safe** with TypeScript
- **Modern UI** with Tailwind CSS and shadcn/ui

## 📁 Project Structure

```
website/
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── layout/            # Layout components
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── sections/          # Page sections
│   │   │   ├── Hero.tsx
│   │   │   ├── QuoteCalculator.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── MobileAppSection.tsx
│   │   │   └── DriverCTA.tsx
│   │   └── ui/                # Reusable UI components
│   │       └── button.tsx
│   └── lib/                   # Utilities
│       ├── utils.ts
│       └── supabase.ts
├── public/                    # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## 🛠️ Installation

### 1. Install Dependencies

```powershell
cd website
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the `website` directory:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your actual values:

```env
# Backend API (Your Railway deployment)
NEXT_PUBLIC_API_URL=https://your-app.up.railway.app/api/v1

# Supabase (Same as mobile app)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Maps API Key (Same as mobile app)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Optional: Background check service
CHECKR_API_KEY=your-checkr-api-key
```

### 3. Run Development Server

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. **Connect to Vercel:**
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Add Environment Variables in Vercel Dashboard:**
   - Go to your project settings
   - Add all variables from `.env.local`

4. **Custom Domain (drivedrop.us.com):**
   - In Vercel project settings, go to "Domains"
   - Add `drivedrop.us.com`
   - Update DNS in Porkbun:
     ```
     Type: CNAME
     Host: @
     Value: cname.vercel-dns.com
     ```

## 📦 What's Next?

### Phase 1: Core Features (Week 1-2)
- [ ] Implement Quote Calculator with Google Places
- [ ] Add form validation with zod
- [ ] Create API routes for quote calculation
- [ ] Style and refine components

### Phase 2: Driver Registration (Week 3-4)
- [ ] Multi-step driver registration form
- [ ] Document upload functionality
- [ ] Backend API integration
- [ ] Email notifications
- [ ] Admin review dashboard

### Phase 3: Advanced Features (Week 5-6)
- [ ] Background check integration (Checkr)
- [ ] Payment processing
- [ ] User authentication
- [ ] Shipment tracking

## 🔗 Integration with Existing Backend

The website uses your existing Railway backend API:

```typescript
// Example API call
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/quotes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pickupLocation,
    deliveryLocation,
    vehicleType
  })
});
```

## 🗄️ Database

Uses the same Supabase database as your mobile app. No additional migrations needed for basic features.

For driver applications, you'll need to add:
- `driver_applications` table (SQL provided in docs)
- Supabase Storage buckets for documents

## 📱 Deep Linking to Mobile App

```typescript
// Link from website to mobile app
const deepLink = `drivedrop://create-shipment?pickup=${encodeURIComponent(pickup)}&delivery=${encodeURIComponent(delivery)}`;

// Fallback to app store if app not installed
window.location = deepLink;
setTimeout(() => {
  window.location = 'https://play.google.com/store/apps/details?id=com.drivedrop.app';
}, 2000);
```

## 🎨 Customization

### Colors

Edit `src/app/globals.css` to change theme colors:

```css
:root {
  --primary: 221.2 83.2% 53.3%;  /* Primary brand color */
  --secondary: 210 40% 96.1%;     /* Secondary color */
  /* ... */
}
```

### Components

All components use Tailwind CSS classes. Customize by editing the className props.

## 📝 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript types
```

## 🔒 Security

- Environment variables protected with Next.js conventions
- SSN encryption for driver applications
- Secure document uploads with Supabase RLS
- FCRA-compliant data handling

## 📚 Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Supabase Docs](https://supabase.com/docs)

## 🤝 Contributing

This website is part of the DriveDrop monorepo. Changes should be committed alongside mobile and backend updates.

## 📄 License

Same as parent project.

---

**Status:** ✅ Basic structure complete, ready for feature development!

**Next Step:** Run `npm install` and `npm run dev` to start building!
