'use client'

import { useState, useEffect } from 'react'
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
import { pricingService } from '@/services/pricingService'

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
    baseRatePerMile: number
    distanceBand: string
    rawBasePrice: number
    deliveryType: string
    deliveryTypeMultiplier: number
    fuelAdjustmentPercent: number
    minimumApplied: boolean
    total: number
  }
}

export default function QuoteCalculator() {
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null)

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

  const handlePickupSelect = (address: string, coordinates: { lat: number; lng: number }) => {
    setValue('pickupLocation', address, { shouldValidate: true })
    setPickupCoords(coordinates)
  }

  const handleDeliverySelect = (address: string, coordinates: { lat: number; lng: number }) => {
    setValue('deliveryLocation', address, { shouldValidate: true })
    setDeliveryCoords(coordinates)
  }

  // Recalculate quote when shipping speed or vehicle type changes
  useEffect(() => {
    if (quote && pickupCoords && deliveryCoords) {
      // Recalculate with new settings
      onSubmit({ 
        pickupLocation: watch('pickupLocation'),
        deliveryLocation: watch('deliveryLocation'),
        vehicleType: selectedVehicleType,
        shippingSpeed: selectedShippingSpeed 
      })
    }
  }, [selectedShippingSpeed, selectedVehicleType])

  const onSubmit = async (data: QuoteFormData) => {
    setLoading(true)
    setError(null)
    setQuote(null)

    try {
      // Validate that we have coordinates
      if (!pickupCoords || !deliveryCoords) {
        throw new Error('Please select valid addresses from the dropdown')
      }

      // Calculate distance using pricingService (same as ShipmentForm)
      const distance = pricingService.calculateDistance(
        pickupCoords.lat,
        pickupCoords.lng,
        deliveryCoords.lat,
        deliveryCoords.lng
      )

      console.log('Calculated distance:', distance, 'miles')

      // Determine delivery dates based on shipping speed
      // Express = no delivery date (blank = expedited = +25%)
      // Standard = no dates at all (standard = 1.0x multiplier, no charge)
      let pickupDate: string | undefined
      let deliveryDate: string | undefined
      
      if (data.shippingSpeed === 'express') {
        // Express: provide pickup but blank delivery date triggers expedited pricing (+25%)
        pickupDate = new Date().toISOString().split('T')[0]
        deliveryDate = undefined
      } else {
        // Standard: no dates at all = standard pricing (1.0x multiplier)
        pickupDate = undefined
        deliveryDate = undefined
      }

      console.log('Pricing inputs:', { 
        pickupDate, 
        deliveryDate, 
        shippingSpeed: data.shippingSpeed,
        vehicleType: data.vehicleType 
      })

      // Calculate quote using pricingService (same logic as ShipmentForm)
      const quoteResult = pricingService.calculateQuote({
        vehicleType: data.vehicleType,
        distanceMiles: Math.round(distance),
        isAccidentRecovery: false,
        vehicleCount: 1,
        pickupDate,
        deliveryDate,
        fuelPricePerGallon: 3.70, // Current default fuel price
      })

      console.log('Quote calculated:', quoteResult)

      // Determine estimated days based on delivery type returned from pricing service
      let estimatedDays: number
      if (quoteResult.breakdown.deliveryType === 'expedited') {
        estimatedDays = 2
      } else if (quoteResult.breakdown.deliveryType === 'flexible') {
        estimatedDays = 7
      } else {
        estimatedDays = 5
      }

      // Set the quote result
      setQuote({
        totalPrice: quoteResult.total,
        distance: Math.round(distance),
        estimatedDays,
        breakdown: quoteResult.breakdown,
      })
    } catch (err) {
      console.error('Quote calculation error:', err)
      setError(err instanceof Error ? err.message : 'Unable to calculate quote. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenInApp = () => {
    // Redirect to client sign up page to continue with shipment
    window.location.href = '/signup?role=client&continue=shipment'
  }

  return (
    <section id="quote" className="border-b border-border bg-[hsl(var(--surface-field))]">
      {/* Section Header */}
      <div className="px-6 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Pricing & Quote</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Transparent per-mile pricing — calculate your exact cost instantly
        </p>
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto">
          {/* Pricing Tiers Overview */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Per-Mile Rates by Vehicle Type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-white border border-border rounded-lg p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Short Distance</div>
                <div className="text-[10px] text-muted-foreground mb-2">Up to 500 miles</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">Sedan</span><span className="font-semibold">$1.80/mi</span></div>
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">SUV / Van</span><span className="font-semibold">$2.00/mi</span></div>
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">Truck</span><span className="font-semibold">$2.20/mi</span></div>
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">Motorcycle</span><span className="font-semibold">$1.50/mi</span></div>
                </div>
              </div>
              <div className="bg-white border-2 border-primary/30 rounded-lg p-4 text-center relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-medium">Most Common</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Mid Distance</div>
                <div className="text-[10px] text-muted-foreground mb-2">500–1,500 miles</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">Sedan</span><span className="font-semibold">$0.95/mi</span></div>
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">SUV / Van</span><span className="font-semibold">$1.05/mi</span></div>
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">Truck</span><span className="font-semibold">$1.15/mi</span></div>
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">Motorcycle</span><span className="font-semibold">$0.80/mi</span></div>
                </div>
              </div>
              <div className="bg-white border border-border rounded-lg p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Long Distance</div>
                <div className="text-[10px] text-muted-foreground mb-2">Over 1,500 miles</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">Sedan</span><span className="font-semibold">$0.60/mi</span></div>
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">SUV / Van</span><span className="font-semibold">$0.70/mi</span></div>
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">Truck</span><span className="font-semibold">$0.75/mi</span></div>
                  <div className="flex justify-between px-2"><span className="text-muted-foreground">Motorcycle</span><span className="font-semibold">$0.50/mi</span></div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span>⚡ Express: +25%</span>
              <span>📅 Flexible: −5%</span>
              <span>💰 Minimum: $150</span>
              <span>💳 Pay 20% upfront, 80% on delivery</span>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Shipment Details</CardTitle>
              <CardDescription>
                Enter your pickup and delivery locations to get an accurate quote
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Pickup Location */}
                <div className="space-y-2">
                  <Label htmlFor="pickupLocation">
                    <MapPin className="inline h-4 w-4 mr-2" />
                    Pickup Location
                  </Label>
                  <GooglePlacesAutocomplete
                    onSelect={handlePickupSelect}
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
                    onSelect={handleDeliverySelect}
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
            <Card className="mt-6 border-2 border-primary shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Your Quote</CardTitle>
                    <CardDescription className="mt-1">
                      {quote.distance} miles • {quote.estimatedDays} business days
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-primary">
                      ${quote.totalPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price Breakdown - Simplified */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Base Rate</span>
                    <span>${quote.breakdown.rawBasePrice.toFixed(2)}</span>
                  </div>
                  
                  {quote.breakdown.deliveryTypeMultiplier !== 1.0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {quote.breakdown.deliveryType === 'expedited' && '⚡ Express Delivery'}
                        {quote.breakdown.deliveryType === 'flexible' && '📅 Flexible Delivery'}
                      </span>
                      <span className={quote.breakdown.deliveryType === 'flexible' ? 'text-green-600 font-medium' : 'font-medium'}>
                        {quote.breakdown.deliveryType === 'expedited' && '+25%'}
                        {quote.breakdown.deliveryType === 'flexible' && '-5%'}
                      </span>
                    </div>
                  )}
                  
                  {quote.breakdown.fuelAdjustmentPercent !== 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Fuel Adjustment</span>
                      <span className={quote.breakdown.fuelAdjustmentPercent > 0 ? '' : 'text-green-600'}>
                        {quote.breakdown.fuelAdjustmentPercent > 0 ? '+' : ''}
                        {quote.breakdown.fuelAdjustmentPercent.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  
                  <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold text-base">
                    <span>Total Price</span>
                    <span className="text-primary">${quote.totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="font-semibold text-blue-900 mb-1">Payment Terms</div>
                  <div className="text-blue-800 space-y-1">
                    <div className="flex justify-between">
                      <span>Pay Now (20%):</span>
                      <span className="font-semibold">${(quote.totalPrice * 0.2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pay on Delivery (80%):</span>
                      <span className="font-semibold">${(quote.totalPrice * 0.8).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="pt-2">
                  <Button onClick={handleOpenInApp} className="w-full" size="lg">
                    Book This Shipment
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
    </section>
  )
}
