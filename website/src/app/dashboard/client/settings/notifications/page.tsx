'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Mail, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase'

interface NotificationPrefs {
  email_shipment_updates: boolean
  email_payment_receipts: boolean
  email_promotions: boolean
  push_shipment_updates: boolean
  push_payment_alerts: boolean
}

const defaults: NotificationPrefs = {
  email_shipment_updates: true,
  email_payment_receipts: true,
  email_promotions: false,
  push_shipment_updates: true,
  push_payment_alerts: true,
}

/** Map our UI prefs to client_settings DB columns */
function prefsToDb(prefs: NotificationPrefs) {
  return {
    // email_notifications = any email pref on
    email_notifications: prefs.email_shipment_updates || prefs.email_payment_receipts,
    shipment_updates: prefs.email_shipment_updates,
    marketing_emails: prefs.email_promotions,
    promotional_offers: prefs.email_promotions,
    // push_notifications = any push pref on
    push_notifications: prefs.push_shipment_updates || prefs.push_payment_alerts,
  }
}

/** Map DB row back to our UI prefs */
function dbToPrefs(row: Record<string, unknown>): NotificationPrefs {
  return {
    email_shipment_updates: (row.shipment_updates as boolean) ?? defaults.email_shipment_updates,
    email_payment_receipts: (row.email_notifications as boolean) ?? defaults.email_payment_receipts,
    email_promotions: (row.marketing_emails as boolean) ?? defaults.email_promotions,
    push_shipment_updates: (row.push_notifications as boolean) ?? defaults.push_shipment_updates,
    push_payment_alerts: (row.push_notifications as boolean) ?? defaults.push_payment_alerts,
  }
}

export default function NotificationsSettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPrefs = useCallback(async () => {
    if (!user?.id) return
    const supabase = getSupabaseBrowserClient()
    const { data, error: dbErr } = await supabase
      .from('client_settings')
      .select('email_notifications, push_notifications, marketing_emails, promotional_offers, shipment_updates')
      .eq('client_id', user.id)
      .maybeSingle()

    if (!dbErr && data) {
      setPrefs(dbToPrefs(data as Record<string, unknown>))
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { loadPrefs() }, [loadPrefs])

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    setError(null)
    const supabase = getSupabaseBrowserClient()
    const { error: upsertErr } = await supabase
      .from('client_settings')
      .upsert(
        { client_id: user.id, ...prefsToDb(prefs) },
        { onConflict: 'client_id' }
      )
    setSaving(false)
    if (upsertErr) {
      setError('Failed to save preferences. Please try again.')
    } else {
      setSaved(true)
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? (
          <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span>
        ) : saved ? (
          <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Saved</span>
        ) : 'Save Preferences'}
      </Button>
    </div>
  )
}
