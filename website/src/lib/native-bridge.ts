// The planner also runs inside the DriveDrop Route Planner app, which loads this site and adds what a browser cannot: tracking in the background and phone-grade speech recognition.
export interface NativeInfo {
  platform: string
  // The app can listen to the driver for Benji; a phone's built-in web view cannot.
  speech?: boolean
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
