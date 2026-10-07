type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> }
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }

export function canFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.fullscreenEnabled || (document.documentElement as FullscreenElement).webkitRequestFullscreen)
}

export function isFullscreen(): boolean {
  const doc = document as FullscreenDocument
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement)
}

// Must run inside a tap handler; browsers refuse fullscreen otherwise.
export async function enterFullscreen(): Promise<boolean> {
  const element = document.documentElement as FullscreenElement
  try {
    if (element.requestFullscreen) await element.requestFullscreen({ navigationUI: 'hide' })
    else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen()
    else return false
    return true
  } catch {
    return false
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return
  const doc = document as FullscreenDocument
  try {
    if (document.exitFullscreen) await document.exitFullscreen()
    else await doc.webkitExitFullscreen?.()
  } catch {
    // Already left by the system gesture.
  }
}

// iPhone Safari has no fullscreen API; an installed home-screen app is the only way to hide its toolbars.
export function isIphoneBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches
  return /iphone|ipod/i.test(navigator.userAgent) && !standalone
}
