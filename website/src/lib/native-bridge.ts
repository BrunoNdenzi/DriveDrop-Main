// The planner also runs inside the DriveDrop Route Planner app, which loads this site and adds what a browser cannot: tracking in the background and phone-grade speech recognition.
export interface NativeInfo {
  platform: string
  // The app can listen to the driver for Benji; a phone's built-in web view cannot.
  speech?: boolean
  // The app explains location use and asks for permission when the page sends "location-need", and answers "location-ready".
  locationGate?: boolean
}

declare global {
  interface Window {
    __DRIVEDROP_NATIVE__?: NativeInfo
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}

// Events the app sends back to the page arrive on window under this name.
export const NATIVE_EVENT = 'drivedrop-native'

export function nativeInfo(): NativeInfo | null {
  if (typeof window === 'undefined') return null
  return window.ReactNativeWebView ? window.__DRIVEDROP_NATIVE__ ?? null : null
}

export const isNativeApp = (): boolean => nativeInfo() !== null

export function postToNative(message: Record<string, unknown>): boolean {
  if (typeof window === 'undefined' || !window.ReactNativeWebView) return false
  window.ReactNativeWebView.postMessage(JSON.stringify(message))
  return true
}

export const hasLocationGate = (): boolean => nativeInfo()?.locationGate === true

// Resolves once the app has shown its location explanation and asked for permission, so the page's own location request comes after it.
export function requestNativeLocation(timeoutMs = 120_000): Promise<boolean> {
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (granted: boolean) => {
      window.removeEventListener(NATIVE_EVENT, onEvent)
      if (timer) clearTimeout(timer)
      resolve(granted)
    }
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; granted?: boolean }>).detail
      if (detail?.type === 'location-ready') finish(detail.granted === true)
    }
    window.addEventListener(NATIVE_EVENT, onEvent)
    timer = setTimeout(() => finish(false), timeoutMs)
    if (!postToNative({ type: 'location-need' })) finish(true)
  })
}
