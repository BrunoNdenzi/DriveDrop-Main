'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Settings,
  DollarSign,
  Bell,
  Shield,
  Mail,
  Globe,
  Truck,
  Building2,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

interface PlatformSettings {
  // Commission & Fees
  platformFeeRate: number
  brokerDefaultCommission: number
  driverMinPayout: number
  stripeEnabled: boolean
  // Notifications
  emailNotificationsEnabled: boolean
  smsNotificationsEnabled: boolean
  newShipmentAlerts: boolean
  driverApplicationAlerts: boolean
  paymentAlerts: boolean
  // Operations
  maxActiveShipmentsPerDriver: number
  maxActiveShipmentsPerBroker: number
  autoAssignEnabled: boolean
  requirePickupVerification: boolean
  requireDeliveryPhotos: boolean
  // Broker
  brokerRegistrationOpen: boolean
  brokerRequiresApproval: boolean
  loadBoardPublicAccess: boolean
  maxBrokerCommissionRate: number
  // General
  maintenanceMode: boolean
  supportEmail: string
  supportPhone: string
  termsUrl: string
  privacyUrl: string
}

const DEFAULT_SETTINGS: PlatformSettings = {
  platformFeeRate: 10,
  brokerDefaultCommission: 15,
  driverMinPayout: 50,
  stripeEnabled: true,
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: false,
  newShipmentAlerts: true,
  driverApplicationAlerts: true,
  paymentAlerts: true,
  maxActiveShipmentsPerDriver: 5,
  maxActiveShipmentsPerBroker: 50,
  autoAssignEnabled: false,
  requirePickupVerification: true,
  requireDeliveryPhotos: true,
  brokerRegistrationOpen: true,
  brokerRequiresApproval: true,
  loadBoardPublicAccess: true,
  maxBrokerCommissionRate: 25,
  maintenanceMode: false,
  supportEmail: 'support@drivedrop.us.com',
  supportPhone: '',
  termsUrl: 'https://drivedrop.us.com/terms',
  privacyUrl: 'https://drivedrop.us.com/privacy',
}

export default function AdminSettingsPage() {
  const { profile } = useAuth()
  const supabase = getSupabaseBrowserClient()
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('general')

  // Load settings from platform_settings table (or use defaults)
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('key, value')

        if (data && data.length > 0) {
          const loaded: Record<string, any> = {}
          data.forEach((row: any) => {
            try {
              loaded[row.key] = JSON.parse(row.value)
            } catch {
              loaded[row.key] = row.value
            }
          })
          setSettings({ ...DEFAULT_SETTINGS, ...loaded } as PlatformSettings)
        }
      } catch {
        // Table may not exist yet — use defaults
        console.log('Using default settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      // Upsert each setting key-value pair
      const entries = Object.entries(settings)
      for (const [key, value] of entries) {
        await supabase
          .from('platform_settings')
          .upsert(
            { key, value: JSON.stringify(value), updated_by: profile?.id, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          )
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      console.error('Error saving settings:', err)
      setError(err.message || 'Failed to save settings. The platform_settings table may need to be created.')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const Toggle = ({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-purple-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )

  const NumberField = ({ value, onChange, label, description, min, max, suffix }: { value: number; onChange: (v: number) => void; label: string; description?: string; min?: number; max?: number; suffix?: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          className="w-24 h-8 text-sm text-right"
        />
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
    </div>
  )

  const TextField = ({ value, onChange, label, description, placeholder }: { value: string; onChange: (v: string) => void; label: string; description?: string; placeholder?: string }) => (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 h-8 text-sm"
      />
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Platform Settings</h1>
          <p className="text-xs text-gray-500">Configure DriveDrop platform behavior and policies</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              Error
            </span>
          )}
          <Button
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="h-8 text-xs bg-purple-500 hover:bg-purple-600 text-white"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5" />
            ) : (
              <Save className="h-3 w-3 mr-1.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="general" className="text-xs gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-xs gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="operations" className="text-xs gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="broker" className="text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Broker
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-4">
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-500" />
              General Configuration
            </h2>
            <Toggle
              checked={settings.maintenanceMode}
              onChange={(v) => updateSetting('maintenanceMode', v)}
              label="Maintenance Mode"
              description="When enabled, users will see a maintenance page. Only admins can access the platform."
            />
            <TextField
              value={settings.supportEmail}
              onChange={(v) => updateSetting('supportEmail', v)}
              label="Support Email"
              description="Email address shown to users for support inquiries"
              placeholder="support@drivedrop.us.com"
            />
            <TextField
              value={settings.supportPhone}
              onChange={(v) => updateSetting('supportPhone', v)}
              label="Support Phone"
              description="Phone number for support (leave blank to hide)"
              placeholder="+1 (555) 000-0000"
            />
            <TextField
              value={settings.termsUrl}
              onChange={(v) => updateSetting('termsUrl', v)}
              label="Terms of Service URL"
              placeholder="https://drivedrop.us.com/terms"
            />
            <TextField
              value={settings.privacyUrl}
              onChange={(v) => updateSetting('privacyUrl', v)}
              label="Privacy Policy URL"
              placeholder="https://drivedrop.us.com/privacy"
            />
          </div>
        </TabsContent>

        {/* Financial Settings */}
        <TabsContent value="financial" className="mt-4">
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              Financial Configuration
            </h2>
            <NumberField
              value={settings.platformFeeRate}
              onChange={(v) => updateSetting('platformFeeRate', v)}
              label="Platform Fee Rate"
              description="Percentage fee charged by DriveDrop on each transaction"
              min={0}
              max={50}
              suffix="%"
            />
            <NumberField
              value={settings.brokerDefaultCommission}
              onChange={(v) => updateSetting('brokerDefaultCommission', v)}
              label="Default Broker Commission"
              description="Default commission rate for new broker accounts"
              min={0}
              max={50}
              suffix="%"
            />
            <NumberField
              value={settings.driverMinPayout}
              onChange={(v) => updateSetting('driverMinPayout', v)}
              label="Minimum Driver Payout"
              description="Minimum payout threshold before drivers can withdraw funds"
              min={0}
              suffix="$"
            />
            <Toggle
              checked={settings.stripeEnabled}
              onChange={(v) => updateSetting('stripeEnabled', v)}
              label="Stripe Payments"
              description="Enable Stripe as the payment processor for all transactions"
            />
          </div>
        </TabsContent>

        {/* Operations Settings */}
        <TabsContent value="operations" className="mt-4">
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-500" />
              Operations Configuration
            </h2>
            <NumberField
              value={settings.maxActiveShipmentsPerDriver}
              onChange={(v) => updateSetting('maxActiveShipmentsPerDriver', v)}
              label="Max Active Shipments Per Driver"
              description="Maximum number of concurrent active deliveries a driver can have"
              min={1}
              max={20}
            />
            <Toggle
              checked={settings.autoAssignEnabled}
              onChange={(v) => updateSetting('autoAssignEnabled', v)}
              label="Auto-Assign Drivers"
              description="Automatically assign the nearest available driver to new shipments"
            />
            <Toggle
              checked={settings.requirePickupVerification}
              onChange={(v) => updateSetting('requirePickupVerification', v)}
              label="Require Pickup Verification"
              description="Drivers must verify vehicle condition at pickup before marking as picked up"
            />
            <Toggle
              checked={settings.requireDeliveryPhotos}
              onChange={(v) => updateSetting('requireDeliveryPhotos', v)}
              label="Require Delivery Photos"
              description="Drivers must upload delivery confirmation photos"
            />
          </div>
        </TabsContent>

        {/* Broker Settings */}
        <TabsContent value="broker" className="mt-4">
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-500" />
              Broker Configuration
            </h2>
            <Toggle
              checked={settings.brokerRegistrationOpen}
              onChange={(v) => updateSetting('brokerRegistrationOpen', v)}
              label="Open Broker Registration"
              description="Allow new brokers to register on the platform"
            />
            <Toggle
              checked={settings.brokerRequiresApproval}
              onChange={(v) => updateSetting('brokerRequiresApproval', v)}
              label="Require Broker Approval"
              description="New broker accounts must be approved by an admin before they can operate"
            />
            <Toggle
              checked={settings.loadBoardPublicAccess}
              onChange={(v) => updateSetting('loadBoardPublicAccess', v)}
              label="Public Load Board Access"
              description="Allow all registered drivers to see public load board listings"
            />
            <NumberField
              value={settings.maxActiveShipmentsPerBroker}
              onChange={(v) => updateSetting('maxActiveShipmentsPerBroker', v)}
              label="Max Active Shipments Per Broker"
              description="Maximum number of concurrent shipments a broker can manage"
              min={1}
              max={500}
            />
            <NumberField
              value={settings.maxBrokerCommissionRate}
              onChange={(v) => updateSetting('maxBrokerCommissionRate', v)}
              label="Max Broker Commission Rate"
              description="Maximum commission rate a broker can charge"
              min={0}
              max={50}
              suffix="%"
            />
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="mt-4">
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              Notification Configuration
            </h2>
            <Toggle
              checked={settings.emailNotificationsEnabled}
              onChange={(v) => updateSetting('emailNotificationsEnabled', v)}
              label="Email Notifications"
              description="Send email notifications to users for important events"
            />
            <Toggle
              checked={settings.smsNotificationsEnabled}
              onChange={(v) => updateSetting('smsNotificationsEnabled', v)}
              label="SMS Notifications"
              description="Send SMS notifications (requires Twilio integration)"
            />
            <Toggle
              checked={settings.newShipmentAlerts}
              onChange={(v) => updateSetting('newShipmentAlerts', v)}
              label="New Shipment Alerts"
              description="Notify admins when new shipments are created"
            />
            <Toggle
              checked={settings.driverApplicationAlerts}
              onChange={(v) => updateSetting('driverApplicationAlerts', v)}
              label="Driver Application Alerts"
              description="Notify admins when new driver applications are submitted"
            />
            <Toggle
              checked={settings.paymentAlerts}
              onChange={(v) => updateSetting('paymentAlerts', v)}
              label="Payment Alerts"
              description="Notify admins of payment events (completions, refunds, disputes)"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
