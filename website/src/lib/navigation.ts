import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

/**
 * Enhanced navigation hook with instant feedback
 * Eliminates the 2-second delay by using React transitions
 */
export function useOptimizedNavigation() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const navigate = (href: string) => {
    startTransition(() => {
      router.push(href)
    })
  }

  const prefetch = (href: string) => {
    router.prefetch(href)
  }

  return { navigate, prefetch, isPending }
}

/**
 * Immediate navigation without transition (for external links)
 */
export function navigateInstant(href: string) {
  window.location.href = href
}
