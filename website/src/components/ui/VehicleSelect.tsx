'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, ChevronsUpDown, Search, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getVehicleMakes, getModelsForMake, searchVehicleMakes, searchVehicleModels } from '@/data/vehicleData'

interface VehicleSelectProps {
  type: 'make' | 'model'
  value: string
  onChange: (value: string) => void
  selectedMake?: string // Required when type is 'model'
  placeholder?: string
  disabled?: boolean
  className?: string
  allowCustom?: boolean // Allow users to enter custom values
  onCustomInput?: (value: string) => void
}

export function VehicleSelect({
  type,
  value,
  onChange,
  selectedMake,
  placeholder,
  disabled = false,
  className,
  allowCustom = true,
  onCustomInput
}: VehicleSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)
  
  // Get options based on type
  const getOptions = (): string[] => {
    if (type === 'make') {
      return searchQuery ? searchVehicleMakes(searchQuery) : getVehicleMakes()
    } else {
      if (!selectedMake) return []
      return searchQuery 
        ? searchVehicleModels(selectedMake, searchQuery) 
        : getModelsForMake(selectedMake)
    }
  }

  const options = getOptions()

  // Reset model when make changes
  useEffect(() => {
    if (type === 'model' && value && selectedMake) {
      const modelsForMake = getModelsForMake(selectedMake)
      if (!modelsForMake.includes(value)) {
        onChange('')
      }
    }
  }, [selectedMake, type, value, onChange])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const isDisabled = disabled || (type === 'model' && !selectedMake)

  const handleSelect = (option: string) => {
    if (option === '__custom__') {
      setShowCustomInput(true)
      setOpen(false)
      setTimeout(() => customInputRef.current?.focus(), 100)
    } else {
      onChange(option)
      setOpen(false)
      setSearchQuery('')
    }
  }

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onChange(customValue.trim())
      if (onCustomInput) {
        onCustomInput(customValue.trim())
      }
      setShowCustomInput(false)
      setCustomValue('')
    }
  }

  const handleCustomCancel = () => {
    setShowCustomInput(false)
    setCustomValue('')
  }

  // Check if current value is not in the list (custom value)
  const isCustomValue = value && !options.includes(value)

  return (
    <>
      <div className={cn("relative", className)} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !isDisabled && setOpen(!open)}
          disabled={isDisabled}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white",
            "hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500",
            "transition-all duration-200",
            !value && "text-gray-400",
            isDisabled && "opacity-50 cursor-not-allowed bg-gray-50",
            open && "border-teal-500 ring-2 ring-teal-500"
          )}
        >
          <span className="truncate text-left">{value || placeholder || `Select ${type}...`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>

      {open && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl max-h-[400px] overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center border-b border-gray-200 px-3 py-2.5 sticky top-0 bg-white">
            <Search className="h-4 w-4 text-gray-400 mr-2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${type === 'make' ? 'makes' : 'models'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-sm outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-[400px] overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No {type === 'make' ? 'makes' : 'models'} found
              </div>
            ) : (
              <>
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors",
                      value === option && "bg-teal-50 text-teal-900 font-medium"
                    )}
                  >
                    <span>{option}</span>
                    {value === option && (
                      <Check className="h-4 w-4 text-teal-600" />
                    )}
                  </button>
                ))}
                
                {/* Custom Option */}
                {allowCustom && (
                  <button
                    type="button"
                    onClick={() => handleSelect('__custom__')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left border-t border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-teal-700 font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Enter custom {type}</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500 bg-gray-50">
            {options.length} {options.length === 1 ? type : `${type}s`} available
          </div>
        </div>
      )}
      </div>

      {/* Custom Input Modal - Separate from dropdown to prevent DOM errors */}
      {showCustomInput && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]" 
          onClick={handleCustomCancel}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4" 
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Enter Custom {type === 'make' ? 'Make' : 'Model'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Can't find your vehicle? Enter the {type} manually below.
            </p>
            <input
              ref={customInputRef}
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomSubmit()
                if (e.key === 'Escape') handleCustomCancel()
              }}
              placeholder={`Enter ${type} name...`}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCustomCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={!customValue.trim()}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add {type === 'make' ? 'Make' : 'Model'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
