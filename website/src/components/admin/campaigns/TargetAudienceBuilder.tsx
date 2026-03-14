'use client'

import { useState } from 'react'
import { TargetAudience } from '@/types/campaigns'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

interface TargetAudienceBuilderProps {
  value: TargetAudience
  onChange: (val: TargetAudience) => void
}

export default function TargetAudienceBuilder({ value, onChange }: TargetAudienceBuilderProps) {
  const [stateSearch, setStateSearch] = useState('')

  function toggleState(st: string) {
    const current = value.states ?? []
    const next = current.includes(st) ? current.filter(s => s !== st) : [...current, st]
    onChange({ ...value, states: next.length ? next : undefined })
  }

  function selectAllStates() {
    onChange({ ...value, states: [...US_STATES] })
  }

  function clearStates() {
    onChange({ ...value, states: undefined })
  }

  const selected = value.states ?? []
  const filtered = US_STATES.filter(s =>
    stateSearch ? s.toLowerCase().startsWith(stateSearch.toLowerCase()) : true
  )

  return (
    <div className="space-y-5">
      {/* States */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            States {selected.length > 0 && <span className="text-[#00B8A9] font-semibold">({selected.length} selected)</span>}
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={selectAllStates} className="text-xs text-[#00B8A9] hover:underline">All</button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={clearStates} className="text-xs text-gray-500 hover:underline">Clear</button>
          </div>
        </div>
        <input
          type="text"
          placeholder="Search states..."
          value={stateSearch}
          onChange={e => setStateSearch(e.target.value)}
          className="w-full mb-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
        />
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
          {filtered.map(st => {
            const active = selected.includes(st)
            return (
              <button
                key={st}
                type="button"
                onClick={() => toggleState(st)}
                className={`text-xs px-1 py-1 rounded transition-colors font-medium ${
                  active
                    ? 'bg-[#00B8A9] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {st}
              </button>
            )
          })}
        </div>
        {selected.length === 0 && (
          <p className="text-xs text-gray-500 mt-1">No states selected — campaign will target all states</p>
        )}
      </div>

      {/* Power Units Range */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">Power Units (fleet size)</label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Min</label>
            <input
              type="number"
              min={1}
              placeholder="1"
              value={value.minPowerUnits ?? ''}
              onChange={e => onChange({ ...value, minPowerUnits: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
            />
          </div>
          <span className="text-gray-400 mt-5">—</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Max</label>
            <input
              type="number"
              min={1}
              placeholder="Any"
              value={value.maxPowerUnits ?? ''}
              onChange={e => onChange({ ...value, maxPowerUnits: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
            />
          </div>
        </div>
      </div>

      {/* Business Type */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">Business Type</label>
        <div className="flex gap-3">
          {[
            { value: undefined, label: 'All' },
            { value: 'carrier', label: 'Carrier' },
            { value: 'broker', label: 'Broker' },
          ].map(opt => (
            <label key={opt.label} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="businessType"
                checked={value.businessType === opt.value}
                onChange={() => onChange({ ...value, businessType: opt.value as TargetAudience['businessType'] })}
                className="accent-[#00B8A9]"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Verified toggle */}
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={value.emailVerified ?? false}
            onChange={e => onChange({ ...value, emailVerified: e.target.checked ? true : undefined })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#00B8A9] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00B8A9]"></div>
        </label>
        <div>
          <p className="text-sm font-medium text-gray-700">Verified emails only</p>
          <p className="text-xs text-gray-500">Only send to carriers with verified email addresses</p>
        </div>
      </div>
    </div>
  )
}
