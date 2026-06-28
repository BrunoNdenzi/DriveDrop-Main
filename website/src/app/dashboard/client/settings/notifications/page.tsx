'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Mail, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface NotificationPrefs {
  email_shipment_updates: boolean
  email_payment_receipts: boolean
  email_promotions: boolean
  push_shipment_updates: boolean
  push_payment_alerts: boolean
}

const STORAGE_KEY = 'dd_notification_prefs'

const defaults: NotificationPrefs = {
  email_shipment_updates: true,
  email_payment_receipts: true,
  email_promotions: false,
  push_shipment_updates: true,
  push_payment_alerts: true,
}

export default function NotificationsSettingsPage() {
  const router = useRouter()
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaults)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setPrefs({ ...defaults, ...JSON.parse(stored) })
    } catch { /* ignore */ }
  }, [])

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch { /* ignore */ }
    setSaved(true)
  }

  const emailItems: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    { key: 'email_shipment_updates', label: 'Shipment status updates', desc: 'Pick-up, transit, and delivery notifications' },
    { key: 'email_payment_receipts', label: 'Payment receipts', desc: 'Booking confirmations and invoices' },
    { key: 'email_promotions', label: 'Promotions & news', desc: 'Occasional offers and DriveDrop updates' },
  ]

  const pushItems: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    { key: 'push_shipment_updates', label: 'Shipment updates', desc: 'Real-time status changes in the dashboard' },
    { key: 'push_payment_alerts', label: 'Payment alerts', desc: 'Instant notifications for payments and bookings' },
  ]

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
          <p className="text-xs text-gray-500">Manage how we contact you</p>
        </div>
      </div>

      {/* Email */}
      <div className="bg-white rounded-md border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Email Notifications</h3>
        </div>
        {emailItems.map(item => (
          <label key={item.key} className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
            <input
              type="checkbox"
              checked={prefs[item.key]}
              onChange={() => toggle(item.key)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </label>
        ))}
      </div>

      {/* Push */}
      <div className="bg-white rounded-md border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">In-App &amp; Push</h3>
        </div>
        {pushItems.map(item => (
          <label key={item.key} className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
            <input
              type="checkbox"
              checked={prefs[item.key]}
              onChange={() => toggle(item.key)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </label>
        ))}
      </div>

      <Button onClick={handleSave} className="w-full">
        {saved ? (
          <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Saved</span>
        ) : 'Save Preferences'}
      </Button>
    </div>
  )
}
