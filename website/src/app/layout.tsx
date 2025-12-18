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
  title: 'DriveDrop - Vehicle Shipping Made Simple',
  description: 'Ship your vehicle anywhere in the US with trusted drivers. Get instant quotes and track your shipment in real-time.',
  keywords: 'vehicle shipping, car transport, auto shipping, vehicle delivery',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'DriveDrop - Vehicle Shipping Made Simple',
    description: 'Ship your vehicle anywhere in the US with trusted drivers.',
    url: 'https://drivedrop.us.com',
    siteName: 'DriveDrop',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/truck-logo.png',
        width: 1200,
        height: 1200,
        alt: 'DriveDrop Logo',
      },
    ],
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
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
          strategy="beforeInteractive"
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
