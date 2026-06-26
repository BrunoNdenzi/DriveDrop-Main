'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import type { InputHTMLAttributes } from 'react'

interface AddressAutocompleteProps {
  value: string
  onSelect: (address: string, coordinates: { lat: number; lng: number }) => void
  onInputChange?: (address: string) => void
  placeholder?: string
}

export default function AddressAutocomplete({
  value,
  onSelect,
  onInputChange,
  placeholder,
  ...inputProps
}: AddressAutocompleteProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onSelect' | 'placeholder'>) {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteService = useRef<any>(null)
  const placesService = useRef<any>(null)

  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null

    const initServices = () => {
      if (typeof window === 'undefined' || !window.google?.maps?.places) return false
      if (autocompleteService.current && placesService.current) return true

      autocompleteService.current = new window.google.maps.places.AutocompleteService()
      placesService.current = new window.google.maps.places.PlacesService(document.createElement('div'))
      return true
    }

    if (!initServices()) {
      // Google script can load after mount on some routes.
      checkInterval = setInterval(() => {
        if (initServices() && checkInterval) {
          clearInterval(checkInterval)
          checkInterval = null
        }
      }, 100)
    }

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval)
      }
    }
  }, [])

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onInputChange?.(newValue)

    if (newValue.length > 2 && autocompleteService.current) {
      autocompleteService.current.getPlacePredictions(
        {
          input: newValue,
          componentRestrictions: { country: 'us' },
        },
        (predictions: any[], status: string) => {
          if (status === 'OK' && predictions) {
            setSuggestions(predictions)
            setShowSuggestions(true)
          } else {
            setSuggestions([])
            setShowSuggestions(false)
          }
        }
      )
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = (placeId: string) => {
    if (placesService.current) {
      placesService.current.getDetails(
        {
          placeId,
          fields: ['geometry', 'formatted_address'],
        },
        (place: any, status: string) => {
          if (status === 'OK' && place) {
            const coordinates = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            }
            setInputValue(place.formatted_address)
            onSelect(place.formatted_address, coordinates)
            setShowSuggestions(false)
          }
        }
      )
    }
  }

  return (
    <div className="relative">
      <Input
        {...inputProps}
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => {
          handleInputChange(e)
          inputProps.onChange?.(e)
        }}
        placeholder={placeholder}
        autoComplete="off"
        onBlur={(e) => {
          setTimeout(() => setShowSuggestions(false), 200)
          inputProps.onBlur?.(e)
        }}
        onFocus={(e) => {
          if (suggestions.length > 0) setShowSuggestions(true)
          inputProps.onFocus?.(e)
        }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion.place_id)}
              className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-0"
            >
              <div className="text-sm font-medium text-gray-900">
                {suggestion.structured_formatting.main_text}
              </div>
              <div className="text-xs text-gray-500">
                {suggestion.structured_formatting.secondary_text}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
