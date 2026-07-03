/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Don't expose Next.js version

  // Performance optimizations
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'recharts',
      'date-fns',
      '@stripe/react-stripe-js',
    ],
  },
  compiler: {
    // Preserve warn/error so instrumentation markers survive production builds
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['warn', 'error'] }
      : false,
  },
  swcMinify: true,
  // Compress responses
  compress: true,

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'tgdewxxmfmbvvcelngeg.supabase.co' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24h (was 1h)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },

  // Webpack: better code splitting and tree shaking
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Split large vendor bundles for better parallel loading
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: 'all',
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Stripe loads separately — only on payment pages
          stripe: {
            name: 'stripe',
            test: /[\\/]node_modules[\\/]@stripe[\\/]/,
            chunks: 'all',
            priority: 30,
          },
          // Recharts only needed in admin dashboard
          recharts: {
            name: 'recharts',
            test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
            chunks: 'all',
            priority: 25,
          },
          // Radix UI components — shared across app
          radix: {
            name: 'radix',
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            chunks: 'all',
            priority: 20,
          },
        },
      }
    }
    return config
  },

  // Headers for better caching and security
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // API routes: no caching
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // HTML pages: security headers + revalidation hint
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Tell browsers to preconnect to key third-party origins
          {
            key: 'Link',
            value: [
              '<https://maps.googleapis.com>; rel=preconnect',
              '<https://fonts.googleapis.com>; rel=preconnect',
              '<https://js.stripe.com>; rel=preconnect',
            ].join(', '),
          },
        ],
      },
    ]
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },
}

module.exports = nextConfig

