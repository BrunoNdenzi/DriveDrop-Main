const reducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Brings the result of what the user just did into view; leaves the page alone when it is already comfortably visible.
export function jumpTo(target: Element | null | undefined, options: { offset?: number; focus?: HTMLElement | null; always?: boolean } = {}): void {
  if (!target || typeof window === 'undefined') return
  const { offset = 12, focus = null, always = false } = options

  // Run after the browser has laid out whatever just rendered.
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    const box = target.getBoundingClientRect()
    const visible = box.top >= offset && box.top < window.innerHeight * 0.6 && box.bottom <= window.innerHeight
    if (always || !visible) {
      window.scrollTo({ top: Math.max(0, box.top + window.scrollY - offset), behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
    focus?.focus({ preventScroll: true })
  }))
}
