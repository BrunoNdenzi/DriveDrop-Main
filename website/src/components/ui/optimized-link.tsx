'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MouseEvent, ReactNode, useTransition, useRef } from 'react'

interface OptimizedLinkProps {
  href: string
  children: ReactNode
  className?: string
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Optimized Link component with instant feedback and hover prefetching
 * - Prefetches on hover (200ms delay to avoid unnecessary prefetches)
 * - Instant visual feedback with transitions
 * - Eliminates navigation delays
 */
export function OptimizedLink({
  href,
  children,
  className,
  prefetch = true,
  replace = false,
  scroll = true,
  onClick,
}: OptimizedLinkProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const prefetchTimeoutRef = useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    // Prefetch after 200ms hover (reduces unnecessary prefetches)
    if (prefetch && !href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('tel')) {
      prefetchTimeoutRef.current = setTimeout(() => {
        router.prefetch(href)
      }, 200)
    }
  }

  const handleMouseLeave = () => {
    // Cancel prefetch if user moves away quickly
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current)
    }
  }

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Call custom onClick if provided
    if (onClick) {
      onClick(e)
    }

    // Only intercept for internal navigation
    if (!href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('tel')) {
      e.preventDefault()
      
      startTransition(() => {
        if (replace) {
          router.replace(href, { scroll })
        } else {
          router.push(href, { scroll })
        }
      })
    }
  }

  return (
    <Link
      href={href}
      className={`${className} ${isPending ? 'opacity-70 pointer-events-none' : 'transition-opacity hover:opacity-90'}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      prefetch={false} // We handle prefetching manually
    >
      {children}
    </Link>
  )
}
