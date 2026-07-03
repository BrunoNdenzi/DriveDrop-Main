'use client'

/**
 * Next.js App Router global error page.
 *
 * Primary purpose: catch ChunkLoadError ("Loading chunk N failed") that occurs
 * when a user's browser has cached an HTML page from a previous deployment that
 * references chunk URLs that no longer exist on the CDN.
 *
 * The Cache-Control: no-cache header on HTML pages (next.config.js) prevents
 * this from happening on fresh loads, but tabs left open across deployments can
 * still trigger it.  In that case we hard-reload so the browser fetches the new
 * HTML and resolves the correct chunk hashes.
 */

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    /loading chunk \d+ failed/i.test(error?.message ?? '')

  useEffect(() => {
    if (isChunkError) {
      // Hard reload fetches the latest HTML + chunk map — no user action needed.
      window.location.reload()
    }
  }, [isChunkError])

  if (isChunkError) {
    // Reload is in flight — show a minimal placeholder so the screen isn't blank.
    return (
      <html>
        <body style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <p style={{ color: '#6b7280' }}>Refreshing…</p>
        </body>
      </html>
    )
  }

  return (
    <html>
      <body style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', gap: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h2>
        <button
          onClick={() => reset()}
          style={{ padding: '8px 20px', background: '#3b82f6', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
