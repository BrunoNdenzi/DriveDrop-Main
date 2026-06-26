'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

interface GooglePlacesAutocompleteProps {
  onSelect: (address: string, coordinates: { lat: number; lng: number }) => void
  onInputChange?: (address: string) => void
  placeholder?: string
  defaultValue?: string
}

export function GooglePlacesAutocomplete({
  onSelect,
  onInputChange,
  placeholder = 'Enter address...',
  defaultValue = '',
}: GooglePlacesAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(defaultValue)
  const [isEnhancedLoaded, setIsEnhancedLoaded] = useState(false)
  const autocompleteRef = useRef<any>(null)

  useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  useEffect(() => {
    if (!containerRef.current) return

    let destroyed = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    let element: HTMLElement | null = null

    const toCoordinates = (location: any) => {
      if (!location) return null

      const lat = typeof location.lat === 'function' ? location.lat() : location.lat
      const lng = typeof location.lng === 'function' ? location.lng() : location.lng

      if (typeof lat !== 'number' || typeof lng !== 'number') return null
      return { lat, lng }
    }

    const initAutocomplete = async () => {
      if (destroyed || !containerRef.current || autocompleteRef.current) return
      if (!window.google?.maps?.places) return

      const placesLibrary = await google.maps.importLibrary('places') as google.maps.PlacesLibrary

      if (destroyed || !containerRef.current) return

      const PlaceAutocompleteElement = (placesLibrary as any).PlaceAutocompleteElement

      if (typeof PlaceAutocompleteElement !== 'function') {
        // If the new element is unavailable, fall back to the legacy widget.
        const legacyInput = document.createElement('input')
        legacyInput.type = 'text'
        legacyInput.value = value
        legacyInput.placeholder = placeholder
        legacyInput.autocomplete = 'off'
        legacyInput.className = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(legacyInput)

        autocompleteRef.current = new google.maps.places.Autocomplete(legacyInput, {
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'geometry', 'name'],
          types: ['address'],
        })

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace()
          if (place?.formatted_address && place?.geometry?.location) {
            const coordinates = toCoordinates(place.geometry.location)
            if (!coordinates) return
            const address = place.formatted_address
            setValue(address)
            onInputChange?.(address)
            onSelect(address, coordinates)
          }
        })

        setIsEnhancedLoaded(true)

        return
      }

      const autocompleteElement = new PlaceAutocompleteElement()
      autocompleteElement.className = 'w-full'

      if ('placeholder' in autocompleteElement) {
        ;(autocompleteElement as any).placeholder = placeholder
      }

      if ('value' in autocompleteElement && value) {
        ;(autocompleteElement as any).value = value
      }

      if ('includedRegionCodes' in autocompleteElement) {
        ;(autocompleteElement as any).includedRegionCodes = ['us']
      }

      autocompleteElement.addEventListener('gmp-select', async (event: Event) => {
        const selectedEvent = event as CustomEvent
        const placePrediction = selectedEvent.detail?.placePrediction || (selectedEvent as any).placePrediction
        if (!placePrediction?.toPlace) return

        const place = placePrediction.toPlace()
        if (typeof place.fetchFields === 'function') {
          await place.fetchFields({ fields: ['formattedAddress', 'location'] })
        }

        const address = place.formattedAddress || place.formatted_address || ''
        const coordinates = toCoordinates(place.location)

        if (!address || !coordinates) return

        setValue(address)
        onInputChange?.(address)
        onSelect(address, coordinates)
      })

      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(autocompleteElement)
      autocompleteRef.current = autocompleteElement
      element = autocompleteElement
      setIsEnhancedLoaded(true)
    }

    if (window.google?.maps?.places) {
      void initAutocomplete()
    } else {
      intervalId = setInterval(() => {
        if (window.google?.maps?.places) {
          void initAutocomplete()
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
      }, 100)
    }

    return () => {
      destroyed = true
      if (intervalId) {
        clearInterval(intervalId)
      }
      if (element && autocompleteRef.current) {
        try {
          autocompleteRef.current.remove()
        } catch {
          // Ignore cleanup failures from custom elements.
        }
      }
      autocompleteRef.current = null
    }
  }, [onSelect])

  return (
    <div className="relative w-full">
      <div ref={containerRef} className="w-full" />
      {!isEnhancedLoaded && (
        <Input
          type="text"
          value={value}
          onChange={(e) => {
            const nextValue = e.target.value
            setValue(nextValue)
            onInputChange?.(nextValue)
          }}
          placeholder={placeholder}
          autoComplete="off"
        />
      )}
    </div>
  )
}

// Type declaration for Google Maps
declare global {
  interface Window {
    google?: typeof google
  }
}
