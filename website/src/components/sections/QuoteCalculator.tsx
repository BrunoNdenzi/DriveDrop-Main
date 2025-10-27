'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowRight, MapPin, Truck, DollarSign } from 'lucide-react'
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete'

const quoteSchema = z.object({
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  deliveryLocation: z.string().min(1, 'Delivery location is required'),
  vehicleType: z.enum(['sedan', 'suv', 'truck', 'van', 'motorcycle'], {
    required_error: 'Please select a vehicle type',
  }),
  shippingSpeed: z.enum(['standard', 'express'], {
    required_error: 'Please select shipping speed',
  }),
})

type QuoteFormData = z.infer<typeof quoteSchema>

interface QuoteResult {
  totalPrice: number
  distance: number
  estimatedDays: number
  breakdown: {
    basePrice: number
    fuelSurcharge: number
    vehicleSurcharge: number
    speedSurcharge: number
  }
}

export default function QuoteCalculator() {
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      vehicleType: 'sedan',
      shippingSpeed: 'standard',
    },
  })

  const selectedVehicleType = watch('vehicleType')
  const selectedShippingSpeed = watch('shippingSpeed')

  const onSubmit = async (data: QuoteFormData) => {
    setLoading(true)
    setError(null)
    setQuote(null)

    try {
      // Call Next.js API route (which proxies to Railway backend)
      const response = await fetch('/api/quotes/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupAddress: data.pickupLocation,
          deliveryAddress: data.deliveryLocation,
          vehicleType: data.vehicleType,
          shippingSpeed: data.shippingSpeed,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to calculate quote')
      }

      const result = await response.json()
      setQuote(result)
    } catch (err) {
      console.error('Quote calculation error:', err)
      setError('Unable to calculate quote. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenInApp = () => {
    const pickup = encodeURIComponent(watch('pickupLocation') || '')
    const delivery = encodeURIComponent(watch('deliveryLocation') || '')
    const vehicleType = watch('vehicleType') || 'sedan'
    
    // Try to open mobile app with deep link
    const deepLink = `drivedrop://create-shipment?pickup=${pickup}&delivery=${delivery}&vehicleType=${vehicleType}`
    
    // Fallback to Play Store if app not installed
    window.location.href = deepLink
    setTimeout(() => {
      window.location.href = 'https://play.google.com/store/apps/details?id=com.drivedrop.app'
    }, 2000)
  }

  return (
    <section id="quote" className="py-20 bg-muted/50">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Get Instant Quote</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Calculate your shipping cost in seconds
          </p>
        </div>

        <div className="mt-12 mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Shipment Details</CardTitle>
              <CardDescription>
                Enter your pickup and delivery locations to get an accurate quote
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Pickup Location */}
                <div className="space-y-2">
                  <Label htmlFor="pickupLocation">
                    <MapPin className="inline h-4 w-4 mr-2" />
                    Pickup Location
                  </Label>
                  <GooglePlacesAutocomplete
                    onSelect={(address) => setValue('pickupLocation', address, { shouldValidate: true })}
                    placeholder="Enter pickup address..."
                  />
                  {errors.pickupLocation && (
                    <p className="text-sm text-destructive">{errors.pickupLocation.message}</p>
                  )}
                </div>

                {/* Delivery Location */}
                <div className="space-y-2">
                  <Label htmlFor="deliveryLocation">
                    <MapPin className="inline h-4 w-4 mr-2" />
                    Delivery Location
                  </Label>
                  <GooglePlacesAutocomplete
                    onSelect={(address) => setValue('deliveryLocation', address, { shouldValidate: true })}
                    placeholder="Enter delivery address..."
                  />
                  {errors.deliveryLocation && (
                    <p className="text-sm text-destructive">{errors.deliveryLocation.message}</p>
                  )}
                </div>

                {/* Vehicle Type */}
                <div className="space-y-2">
                  <Label htmlFor="vehicleType">
                    <Truck className="inline h-4 w-4 mr-2" />
                    Vehicle Type
                  </Label>
                  <Select
                    value={selectedVehicleType}
                    onValueChange={(value) => setValue('vehicleType', value as any, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedan">Sedan</SelectItem>
                      <SelectItem value="suv">SUV</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.vehicleType && (
                    <p className="text-sm text-destructive">{errors.vehicleType.message}</p>
                  )}
                </div>

                {/* Shipping Speed */}
                <div className="space-y-2">
                  <Label>Shipping Speed</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setValue('shippingSpeed', 'standard', { shouldValidate: true })}
                      className={`p-4 border-2 rounded-lg text-left transition-colors ${
                        selectedShippingSpeed === 'standard'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-semibold">Standard</div>
                      <div className="text-sm text-muted-foreground">3-5 business days</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue('shippingSpeed', 'express', { shouldValidate: true })}
                      className={`p-4 border-2 rounded-lg text-left transition-colors ${
                        selectedShippingSpeed === 'express'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-semibold">Express</div>
                      <div className="text-sm text-muted-foreground">1-2 business days</div>
                    </button>
                  </div>
                  {errors.shippingSpeed && (
                    <p className="text-sm text-destructive">{errors.shippingSpeed.message}</p>
                  )}
                </div>

                {/* Submit Button */}
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Calculate Quote
                    </>
                  )}
                </Button>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Quote Result */}
          {quote && (
            <Card className="mt-6 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Your Quote</span>
                  <span className="text-3xl text-primary">
                    ${(quote.totalPrice / 100).toFixed(2)}
                  </span>
                </CardTitle>
                <CardDescription>
                  Estimated delivery: {quote.estimatedDays} business days • Distance: {quote.distance.toFixed(1)} miles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price Breakdown */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Price</span>
                    <span>${(quote.breakdown.basePrice / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fuel Surcharge</span>
                    <span>${(quote.breakdown.fuelSurcharge / 100).toFixed(2)}</span>
                  </div>
                  {quote.breakdown.vehicleSurcharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehicle Type Surcharge</span>
                      <span>${(quote.breakdown.vehicleSurcharge / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {quote.breakdown.speedSurcharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Express Delivery</span>
                      <span>${(quote.breakdown.speedSurcharge / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary">${(quote.totalPrice / 100).toFixed(2)}</span>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="pt-4 space-y-3">
                  <Button onClick={handleOpenInApp} className="w-full" size="lg">
                    Book This Shipment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Pay only 20% upfront • Remaining 80% after delivery
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  )
}
