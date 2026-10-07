import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  manifest: '/route-planner.webmanifest',
  appleWebApp: { capable: true, title: 'Route Planner', statusBarStyle: 'black-translucent' },
}

// viewport-fit=cover lets driving mode use the whole screen and activates the safe-area insets.
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#123638',
}

export default function RoutePlannerLayout({ children }: { children: React.ReactNode }) {
  return children
}
