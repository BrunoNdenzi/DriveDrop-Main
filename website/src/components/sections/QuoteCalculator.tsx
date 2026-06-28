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
import { Loader2, ArrowRight, MapPin, Truck, User, Mail, CheckCircle } from 'lucide-react'
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete'

const quoteSchema = z.object({
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  deliveryLocation: z.string().min(1, 'Delivery location is required'),
  vehicleType: z.enum(['sedan', 'suv', 'truck', 'van', 'motorcycle'], {
    required_error: 'Please select a vehicle type',
  }),
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Please enter a valid email'),
})

type QuoteFormData = z.infer<typeof quoteSchema>

export default function QuoteCalculator() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
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
    },
  })

  const selectedVehicleType = watch('vehicleType')

  const handlePickupSelect = (address: string, coordinates: { lat: number; lng: number }) => {
    setValue('pickupLocation', address, { shouldValidate: true })
    setPickupCoords(coordinates)
  }

  const handleDeliverySelect = (address: string, coordinates: { lat: number; lng: number }) => {
    setValue('deliveryLocation', address, { shouldValidate: true })
    setDeliveryCoords(coordinates)
  }

  const onSubmit = async (data: QuoteFormData) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/quotes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          pickupLocation: data.pickupLocation,
          deliveryLocation: data.deliveryLocation,
          vehicleType: data.vehicleType,
          pickupCoords,
          deliveryCoords,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to send quote')
      }

      setSubmitted(true)
    } catch (err) {
      console.error('Quote send error:', err)
      setError(err instanceof Error ? err.message : 'Unable to send quote. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="quote" className="border-b border-border bg-[hsl(var(--surface-field))]">
      {/* Section Header */}
      <div className="px-6 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Pricing & Quote</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Transparent per-mile pricing — get your personalized quote by email
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
              <CardTitle>Request a Quote</CardTitle>
              <CardDescription>
                Enter your details and we'll email you a personalized shipping quote
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Quote Sent!</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    We've emailed your personalized quote. Please check your spam folder if you don't see it within a few minutes.
                  </p>
                  <div className="pt-2">
                    <Button onClick={() => window.location.href = '/signup?role=client'} className="gap-2">
                      Create Account & Book Now
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
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

                {/* Express notice */}
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                  Need same-day or express delivery?{' '}
                  <a href="/services/freight" className="text-primary underline">Freight services</a>
                  {' '}or{' '}
                  <a href="/services/delivery" className="text-primary underline">van delivery</a>
                  {' '}may be a better fit.
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">
                    <User className="inline h-4 w-4 mr-2" />
                    Your Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">
                    <Mail className="inline h-4 w-4 mr-2" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                {/* Submit Button */}
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Quote...
                    </>
                  ) : (
                    <>
                      Get My Quote by Email
                      <ArrowRight className="ml-2 h-4 w-4" />
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
              )}
            </CardContent>
          </Card>
        </div>
    </section>
  )
}
