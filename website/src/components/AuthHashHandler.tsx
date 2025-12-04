'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * This component handles Supabase auth callbacks that use hash fragments
 * (e.g., password reset with access_token in URL hash)
 * 
 * It runs on every page and checks if there's an access_token in the hash.
 * If found with type=recovery, it redirects to the reset-password page.
 */
export default function AuthHashHandler() {
  const router = useRouter()

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') return

    // Get the hash from the URL
    const hash = window.location.hash
    
    if (!hash) return

    // Parse the hash parameters
    const hashParams = new URLSearchParams(hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const type = hashParams.get('type')
    const errorCode = hashParams.get('error_code')
    const errorDescription = hashParams.get('error_description')

    // Handle errors
    if (errorCode) {
      console.error('Auth error from hash:', errorCode, errorDescription)
      router.push(`/login?error=${encodeURIComponent(errorDescription || errorCode)}`)
      return
    }

    // If we have an access token and it's a recovery type, redirect to reset password
    if (accessToken && type === 'recovery') {
      console.log('Detected password recovery token in hash, redirecting to reset-password')
      // Redirect to reset-password page, preserving the hash
      router.push('/reset-password' + hash)
      return
    }

    // If we have an access token but no type, check current path
    if (accessToken && window.location.pathname === '/') {
      console.log('Detected access token in hash on homepage, redirecting to reset-password')
      router.push('/reset-password' + hash)
    }
  }, [router])

  return null // This component doesn't render anything
}
