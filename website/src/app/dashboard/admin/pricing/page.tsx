'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  createPricingConfig,
  getActivePricingConfig,
  updatePricingConfig,
  type PricingConfig,
} from '@/lib/api/pricing'
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
} from '@/components/icons/streamline-lucide'
import { Button } from '@/components/ui/button'

export default function AdminPricingPage() {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<PricingConfig | null>(null)
  const [editedConfig, setEditedConfig] = useState<Partial<PricingConfig>>({})
  const [changeReason, setChangeReason] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    minimums: true,
    economics: true,
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
      setConfig(await getActivePricingConfig())
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
    setEditedConfig(prev => ({ ...prev, [field]: value }))
  }

  const getValue = (field: keyof PricingConfig): any => {
    return field in editedConfig ? editedConfig[field] : config?.[field]
  }

  const hasChanges = () => {
    return Object.keys(editedConfig).length > 0
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

      if (!config?.id) {
        throw new Error('No pricing config found')
      }

      let savedConfig: PricingConfig
      if (config.id === 'default') {
        const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...configData } = {
          ...config,
          ...editedConfig,
        }
        savedConfig = await createPricingConfig(configData)
      } else {
        savedConfig = await updatePricingConfig(config.id, editedConfig, changeReason)
      }

      setConfig(savedConfig)
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

        <ConfigSection
          title="Economic Floor (Shadow)"
          icon={<TrendingUp className="h-5 w-5" />}
          expanded={expandedSections.economics}
          onToggle={() => toggleSection('economics')}
        >
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            Shadow mode records the estimated floor and gap for analysis. It does not change customer prices.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField
              label="Target Contribution Margin (%)"
              value={getValue('target_contribution_margin_percent')}
              onChange={(v) => updateField('target_contribution_margin_percent', parseFloat(v))}
              type="number"
              step="0.01"
            />
            <InputField
              label="Fallback Fuel Cost / Mile ($)"
              value={getValue('fallback_fuel_cost_per_mile')}
              onChange={(v) => updateField('fallback_fuel_cost_per_mile', parseFloat(v))}
              type="number"
              step="0.0001"
            />
            <InputField
              label="Fallback Driver Cost / Mile ($)"
              value={getValue('fallback_driver_cost_per_mile')}
              onChange={(v) => updateField('fallback_driver_cost_per_mile', parseFloat(v))}
              type="number"
              step="0.0001"
            />
            <InputField
              label="Fallback Insurance Cost / Mile ($)"
              value={getValue('fallback_insurance_cost_per_mile')}
              onChange={(v) => updateField('fallback_insurance_cost_per_mile', parseFloat(v))}
              type="number"
              step="0.0001"
            />
            <InputField
              label="Fallback Maintenance Cost / Mile ($)"
              value={getValue('fallback_maintenance_cost_per_mile')}
              onChange={(v) => updateField('fallback_maintenance_cost_per_mile', parseFloat(v))}
              type="number"
              step="0.0001"
            />
            <InputField
              label="Fallback Tolls Cost / Mile ($)"
              value={getValue('fallback_tolls_cost_per_mile')}
              onChange={(v) => updateField('fallback_tolls_cost_per_mile', parseFloat(v))}
              type="number"
              step="0.0001"
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
