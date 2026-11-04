import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'BenjiGo Route Planner',
  manifest: '/route-planner.webmanifest',
  icons: { icon: '/route-planner-192.png', apple: '/benjigo-apple-touch-180.png' },
  appleWebApp: { capable: true, title: 'BenjiGo', statusBarStyle: 'black-translucent' },
}

// viewport-fit=cover lets driving mode use the whole screen and activates the safe-area insets.
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#0b1f44',
}

export default function RoutePlannerLayout({ children }: { children: React.ReactNode }) {
  return children
}
