'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { 
  DollarSign, 
  TrendingUp, 
  Fuel, 
  Clock, 
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PricingConfig {
  id: string
  min_quote: number
  accident_min_quote: number
  min_miles: number
  base_fuel_price: number
  current_fuel_price: number
  fuel_adjustment_per_dollar: number
  surge_multiplier: number
  surge_enabled: boolean
  expedited_multiplier: number
  flexible_multiplier: number
  standard_multiplier: number
  short_distance_max: number
  mid_distance_max: number
  expedited_service_enabled: boolean
  flexible_service_enabled: boolean
  bulk_discount_enabled: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AdminPricingPage() {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [editedConfig, setEditedConfig] = useState<Partial<PricingConfig>>({})
  const [changeReason, setChangeReason] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    minimums: true,
    fuel: true,
    surge: false,
    delivery: false,
    distance: false,
    services: false,
  })

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadConfig()
    }
  }, [profile])

  const loadConfig = async () => {
    try {
      setLoading(true)
      
      const supabase = getSupabaseBrowserClient()
      
      // Fetch pricing config directly from Supabase
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data) {
        // No active config found, create default
        const defaultConfig = {
          min_quote: 150.00,
          accident_min_quote: 80.00,
          min_miles: 100,
          base_fuel_price: 3.70,
          current_fuel_price: 3.70,
          fuel_adjustment_per_dollar: 5.00,
          surge_multiplier: 1.00,
          surge_enabled: false,
          expedited_multiplier: 1.25,
          standard_multiplier: 1.00,
          flexible_multiplier: 0.95,
          short_distance_max: 500,
          mid_distance_max: 1500,
          bulk_discount_enabled: true,
          expedited_service_enabled: true,
          flexible_service_enabled: true,
          is_active: true
        }
        
        const { data: newConfig, error: createError } = await supabase
          .from('pricing_config')
          .insert([defaultConfig])
          .select()
          .single()
        
        if (createError) throw createError
        setConfig(newConfig as PricingConfig)
      } else {
        setConfig(data as PricingConfig)
      }
      setEditedConfig({})
    } catch (error: any) {
      console.error('Failed to load pricing config:', error)
      alert(error.message || 'Failed to load pricing configuration')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const updateField = (field: keyof PricingConfig, value: any) => {
    console.log('updateField called:', field, value, 'current editedConfig:', editedConfig)
    setEditedConfig(prev => {
      const updated = { ...prev, [field]: value }
      console.log('Updated editedConfig:', updated)
      return updated
    })
  }

  const getValue = (field: keyof PricingConfig): any => {
    return field in editedConfig ? editedConfig[field] : config?.[field]
  }

  const hasChanges = () => {
    const changes = Object.keys(editedConfig).length > 0
    console.log('hasChanges:', changes, 'editedConfig:', editedConfig)
    return changes
  }

  const handleSave = async () => {
    if (!hasChanges()) {
      alert('No changes to save')
      return
    }

    if (!changeReason.trim()) {
      alert('Please provide a reason for this change')
      return
    }

    try {
      setSaving(true)
      
      const supabase = getSupabaseBrowserClient()
      
      if (!config?.id) {
        throw new Error('No pricing config found')
      }

      // Update the pricing config in Supabase
      const { data, error } = await supabase
        .from('pricing_config')
        .update({
          ...editedConfig,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id)
        .select()
        .single()

      if (error) throw error

      // Record the change in history
      await supabase
        .from('pricing_config_history')
        .insert([{
          config_id: config.id,
          change_reason: changeReason,
          old_values: config,
          new_values: { ...config, ...editedConfig }
        }])

      setConfig(data as PricingConfig)
      setEditedConfig({})
      setChangeReason('')
      alert('Pricing configuration updated successfully!')
    } catch (error: any) {
      console.error('Failed to update pricing config:', error)
      alert(error.message || 'Failed to update pricing configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (confirm('Are you sure you want to discard all changes?')) {
      setEditedConfig({})
      setChangeReason('')
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-red-600">Access denied. Admin only.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading pricing configuration...</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-3">Failed to load configuration</p>
          <Button onClick={loadConfig}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        {/* Header */}
        <div className="bg-white rounded-md border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                Dynamic Pricing Configuration
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Last updated: {new Date(config.updated_at).toLocaleDateString()}
              </p>
            </div>
            {hasChanges() && (
              <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-md text-xs">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Unsaved changes</span>
              </div>
            )}
          </div>
        </div>

        {/* Minimum Quotes */}
        <ConfigSection
          title="Minimum Quotes"
          icon={<DollarSign className="h-5 w-5" />}
          expanded={expandedSections.minimums}
          onToggle={() => toggleSection('minimums')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Minimum Quote ($)"
              value={getValue('min_quote')}
              onChange={(v) => updateField('min_quote', parseFloat(v))}
              type="number"
              step="0.01"
            />
            <InputField
              label="Accident Minimum Quote ($)"
              value={getValue('accident_min_quote')}
              onChange={(v) => updateField('accident_min_quote', parseFloat(v))}
              type="number"
              step="0.01"
            />
            <InputField
              label="Minimum Miles"
              value={getValue('min_miles')}
              onChange={(v) => updateField('min_miles', parseFloat(v))}
              type="number"
              step="1"
            />
          </div>
        </ConfigSection>

        {/* Fuel Adjustments */}
        <ConfigSection
          title="Fuel Adjustments"
          icon={<Fuel className="h-5 w-5" />}
          expanded={expandedSections.fuel}
          onToggle={() => toggleSection('fuel')}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField
              label="Base Fuel Price ($)"
              value={getValue('base_fuel_price')}
              onChange={(v) => updateField('base_fuel_price', parseFloat(v))}
              type="number"
              step="0.01"
            />
            <InputField
              label="Current Fuel Price ($)"
              value={getValue('current_fuel_price')}
              onChange={(v) => updateField('current_fuel_price', parseFloat(v))}
              type="number"
              step="0.01"
            />
            <InputField
              label="Adjustment per $ (%)"
              value={getValue('fuel_adjustment_per_dollar')}
              onChange={(v) => updateField('fuel_adjustment_per_dollar', parseFloat(v))}
              type="number"
              step="0.01"
            />
          </div>
        </ConfigSection>

        {/* Surge Pricing */}
        <ConfigSection
          title="Surge Pricing"
          icon={<TrendingUp className="h-5 w-5" />}
          expanded={expandedSections.surge}
          onToggle={() => toggleSection('surge')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SwitchField
              label="Surge Enabled"
              checked={getValue('surge_enabled')}
              onChange={(v) => updateField('surge_enabled', v)}
            />
            <InputField
              label="Surge Multiplier"
              value={getValue('surge_multiplier')}
              onChange={(v) => updateField('surge_multiplier', parseFloat(v))}
              type="number"
              step="0.01"
              disabled={!getValue('surge_enabled')}
            />
          </div>
        </ConfigSection>

        {/* Delivery Speed Multipliers */}
        <ConfigSection
          title="Delivery Speed Multipliers"
          icon={<Clock className="h-5 w-5" />}
          expanded={expandedSections.delivery}
          onToggle={() => toggleSection('delivery')}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField
              label="Expedited Multiplier"
              value={getValue('expedited_multiplier')}
              onChange={(v) => updateField('expedited_multiplier', parseFloat(v))}
              type="number"
              step="0.01"
            />
            <InputField
              label="Standard Multiplier"
              value={getValue('standard_multiplier')}
              onChange={(v) => updateField('standard_multiplier', parseFloat(v))}
              type="number"
              step="0.01"
            />
            <InputField
              label="Flexible Multiplier"
              value={getValue('flexible_multiplier')}
              onChange={(v) => updateField('flexible_multiplier', parseFloat(v))}
              type="number"
              step="0.01"
            />
          </div>
        </ConfigSection>

        {/* Distance Brackets */}
        <ConfigSection
          title="Distance Brackets"
          icon={<TrendingUp className="h-5 w-5" />}
          expanded={expandedSections.distance}
          onToggle={() => toggleSection('distance')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Short Distance Max (miles)"
              value={getValue('short_distance_max')}
              onChange={(v) => updateField('short_distance_max', parseFloat(v))}
              type="number"
              step="1"
            />
            <InputField
              label="Mid Distance Max (miles)"
              value={getValue('mid_distance_max')}
              onChange={(v) => updateField('mid_distance_max', parseFloat(v))}
              type="number"
              step="1"
            />
          </div>
        </ConfigSection>

        {/* Service Toggles */}
        <ConfigSection
          title="Service Options"
          icon={<CheckCircle className="h-5 w-5" />}
          expanded={expandedSections.services}
          onToggle={() => toggleSection('services')}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SwitchField
              label="Expedited Service Enabled"
              checked={getValue('expedited_service_enabled')}
              onChange={(v) => updateField('expedited_service_enabled', v)}
            />
            <SwitchField
              label="Flexible Service Enabled"
              checked={getValue('flexible_service_enabled')}
              onChange={(v) => updateField('flexible_service_enabled', v)}
            />
            <SwitchField
              label="Bulk Discount Enabled"
              checked={getValue('bulk_discount_enabled')}
              onChange={(v) => updateField('bulk_discount_enabled', v)}
            />
          </div>
        </ConfigSection>

        {/* Change Reason */}
        {hasChanges() && (
          <div className="bg-white rounded-md border border-gray-200 p-4 mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Change Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Explain why you're making these changes..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
              rows={2}
            />
          </div>
        )}

        {/* Action Buttons */}
        {hasChanges() && (
          <div className="bg-white rounded-md border border-gray-200 p-4 flex items-center justify-between">
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Changes
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !changeReason.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ConfigSection({ 
  title, 
  icon, 
  expanded, 
  onToggle, 
  children 
}: { 
  title: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-md border border-gray-200 mb-3 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="text-purple-600">{icon}</div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function InputField({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  step, 
  disabled 
}: { 
  label: string
  value: any
  onChange: (value: string) => void
  type?: string
  step?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        disabled={disabled}
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
    </div>
  )
}

function SwitchField({ 
  label, 
  checked, 
  onChange 
}: { 
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-purple-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
