import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ToastContainer } from '@/components/ui/toast'
import AuthHashHandler from '@/components/AuthHashHandler'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://drivedrop.us.com'),
  title: {
    default: 'DriveDrop - Vehicle Shipping Made Simple',
    template: '%s | DriveDrop'
  },
  description: 'Professional vehicle shipping with 1,000+ verified drivers. Get instant quotes in 30 seconds, real-time GPS tracking, and full insurance up to $100k. Rated 4.9/5 by 10,000+ customers.',
  keywords: ['vehicle shipping', 'car transport', 'auto shipping', 'vehicle delivery', 'car shipping service', 'vehicle transport', 'door to door car shipping', 'nationwide vehicle shipping', 'insured car transport'],
  authors: [{ name: 'DriveDrop' }],
  creator: 'DriveDrop',
  publisher: 'DriveDrop',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://drivedrop.us.com',
    siteName: 'DriveDrop',
    title: 'DriveDrop - Vehicle Shipping Made Simple',
    description: 'Professional vehicle shipping with 1,000+ verified drivers. Get instant quotes in 30 seconds, real-time GPS tracking, and full insurance up to $100k.',
    images: [
      {
        url: '/truck-logo.png',
        width: 1200,
        height: 630,
        alt: 'DriveDrop - Professional Vehicle Shipping Service',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DriveDrop - Vehicle Shipping Made Simple',
    description: 'Get instant quotes in 30 seconds. 1,000+ verified drivers. Real-time GPS tracking. Rated 4.9/5 by 10,000+ customers.',
    images: ['/truck-logo.png'],
    creator: '@drivedrop',
  },
  verification: {
    google: 'your-google-verification-code', // Add your actual verification code
  },
  alternates: {
    canonical: 'https://drivedrop.us.com',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-6YW64F8QMB"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-6YW64F8QMB', {
                page_path: window.location.pathname,
                send_page_view: true
              });
              
              // Track custom events for conversion optimization
              window.gtag = gtag;
            `,
          }}
        />
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
          strategy="beforeInteractive"
        />
        {/* JSON-LD Structured Data for Rich Search Results */}
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'DriveDrop',
              url: 'https://drivedrop.us.com',
              logo: 'https://drivedrop.us.com/truck-logo.png',
              description: 'Professional vehicle shipping service with verified drivers nationwide',
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: '+1-704-266-2317',
                contactType: 'Customer Service',
                email: 'infos@calkons.com',
                areaServed: 'US',
                availableLanguage: 'English'
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.9',
                reviewCount: '10000',
                bestRating: '5',
                worstRating: '1'
              },
              sameAs: [
                'https://facebook.com/drivedrop',
                'https://twitter.com/drivedrop',
                'https://instagram.com/drivedrop'
              ],
              service: {
                '@type': 'Service',
                name: 'Vehicle Shipping',
                serviceType: 'Vehicle Transportation',
                provider: {
                  '@type': 'Organization',
                  name: 'DriveDrop'
                },
                areaServed: {
                  '@type': 'Country',
                  name: 'United States'
                },
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: 'Vehicle Shipping Services',
                  itemListElement: [
                    {
                      '@type': 'Offer',
                      itemOffered: {
                        '@type': 'Service',
                        name: 'Standard Vehicle Shipping',
                        description: 'Door-to-door vehicle shipping with verified drivers'
                      }
                    },
                    {
                      '@type': 'Offer',
                      itemOffered: {
                        '@type': 'Service',
                        name: 'Express Vehicle Shipping',
                        description: 'Expedited vehicle delivery service'
                      }
                    }
                  ]
                }
              }
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <AuthHashHandler />
        {children}
        <ToastContainer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
