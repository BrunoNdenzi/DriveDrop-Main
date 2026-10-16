'use client'

import { useEffect, useState } from 'react'
import { isIphoneBrowser } from '@/lib/fullscreen'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'planner-install-dismissed'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY))
    return Number.isFinite(at) && Date.now() - at < SNOOZE_MS
  } catch {
    return false
  }
}

// Installing puts the planner on the home screen without browser bars, and the phone is less likely to drop it while the driver is in another app.
export default function InstallApp({ showBanner }: { showBanner: boolean }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [iphone, setIphone] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/route-planner-sw.js', { scope: '/route-planner' }).catch(() => undefined)
    }
    if (isInstalled()) return
    setHidden(snoozed())
    setIphone(isIphoneBrowser())
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => { setPrompt(null); setIphone(false) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!showBanner || hidden || (!prompt && !iphone)) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* storage unavailable */ }
    setHidden(true)
  }
  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice.catch(() => null)
    setPrompt(null)
    if (choice?.outcome === 'dismissed') dismiss()
  }

  return (
    <section aria-label="Install Route Planner" className="mt-5 flex flex-wrap items-center gap-3 border border-[#b9d8d4] bg-[#edf8f6] p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#254947]">Install Route Planner on your phone</p>
        <p className="mt-0.5 text-sm text-[#496764]">
          {iphone && !prompt
            ? 'Tap Share, then Add to Home Screen. It opens full screen and picks your trip back up faster.'
            : 'Opens full screen from your home screen, and picks your trip back up faster after a call or app switch.'}
        </p>
      </div>
      {prompt && <button onClick={() => void install()} className="h-11 bg-[#173f40] px-5 text-sm font-bold text-white">Install</button>}
      <button onClick={dismiss} className="h-11 px-3 text-sm font-semibold text-[#00756d]">Not now</button>
    </section>
  )
}
