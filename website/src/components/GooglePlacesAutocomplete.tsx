'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

interface GooglePlacesAutocompleteProps {
  onSelect: (address: string) => void
  placeholder?: string
  defaultValue?: string
}

export function GooglePlacesAutocomplete({
  onSelect,
  placeholder = 'Enter address...',
  defaultValue = '',
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultValue)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    if (!inputRef.current) return

    const initAutocomplete = () => {
      if (!inputRef.current || !window.google?.maps?.places) return

      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry', 'name'],
        types: ['address'],
      })

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace()
        if (place?.formatted_address) {
          setValue(place.formatted_address)
          onSelect(place.formatted_address)
        }
      })
    }

    // Wait for Google Maps to be loaded (from layout.tsx)
    if (window.google?.maps?.places) {
      initAutocomplete()
    } else {
      // Retry after a short delay if not loaded yet
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places) {
          initAutocomplete()
          clearInterval(checkInterval)
        }
      }, 100)

      return () => clearInterval(checkInterval)
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [onSelect])

  return (
    <Input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  )
}

// Type declaration for Google Maps
declare global {
  interface Window {
    google?: typeof google
  }
}
