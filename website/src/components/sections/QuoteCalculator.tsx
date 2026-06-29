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
import { Loader2, ArrowRight, MapPin, Truck, User, Mail, CheckCircle, Zap, LayoutDashboard } from 'lucide-react'
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete'

const quoteSchema = z.object({
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  deliveryLocation: z.string().min(1, 'Delivery location is required'),
  vehicleType: z.enum(['sedan', 'suv', 'truck', 'van', 'motorcycle'], {
    required_error: 'Please select a vehicle type',
  }),
  vehicleYear: z.string().min(4, 'Enter a valid year').regex(/^\d{4}$/, 'Enter a 4-digit year'),
  vehicleModel: z.string().min(1, 'Vehicle make & model is required'),
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

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { vehicleType: 'sedan', vehicleYear: '', vehicleModel: '' },
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
          vehicleYear: data.vehicleYear,
          vehicleModel: data.vehicleModel,
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
      setError(err instanceof Error ? err.message : 'Unable to send quote. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="quote" className="border-b border-border bg-[hsl(var(--surface-field))]">
      <div className="px-6 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Pricing & Quote</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Transparent per-mile pricing — receive your personalized quote by email
        </p>
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto">
        {/* Pricing Tiers */}
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
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>📅 Flexible (5+ day window): −5%</span>
            <span>💰 Minimum: $150</span>
            <span>💳 Pay 20% upfront, 80% on delivery</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{submitted ? 'Quote Request Received!' : 'Request Your Quote'}</CardTitle>
            <CardDescription>
              {submitted
                ? 'Your personalized quote is on its way to your inbox'
                : "Fill in your details and we'll send you an accurate quote by email"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-8 space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                  We've emailed your personalized quote. If you don't see it within a few minutes, please check your spam/junk folder.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm mx-auto pt-2">
                  <a href="/signup?role=client" className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 hover:border-blue-400 transition-colors text-left">
                    <LayoutDashboard className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-900">Create Account</p>
                      <p className="text-[10px] text-gray-500">Book & track with TMS</p>
                    </div>
                  </a>
                  <a href="/services/freight" className="flex items-center gap-2 p-3 rounded-lg border border-orange-200 bg-orange-50 hover:border-orange-400 transition-colors text-left">
                    <Zap className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-900">Need it Faster?</p>
                      <p className="text-[10px] text-gray-500">Express & freight options</p>
                    </div>
                  </a>
                </div>
                <button onClick={() => setSubmitted(false)} className="text-xs text-muted-foreground underline mt-2">
                  Request another quote
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label><MapPin className="inline h-3.5 w-3.5 mr-1" />Pickup Location</Label>
                    <GooglePlacesAutocomplete onSelect={handlePickupSelect} placeholder="Enter pickup address..." />
                    {errors.pickupLocation && <p className="text-xs text-destructive">{errors.pickupLocation.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label><MapPin className="inline h-3.5 w-3.5 mr-1" />Delivery Location</Label>
                    <GooglePlacesAutocomplete onSelect={handleDeliverySelect} placeholder="Enter delivery address..." />
                    {errors.deliveryLocation && <p className="text-xs text-destructive">{errors.deliveryLocation.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label><Truck className="inline h-3.5 w-3.5 mr-1" />Type</Label>
                    <Select value={selectedVehicleType} onValueChange={(v) => setValue('vehicleType', v as any, { shouldValidate: true })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedan">Sedan</SelectItem>
                        <SelectItem value="suv">SUV</SelectItem>
                        <SelectItem value="truck">Truck</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="motorcycle">Motorcycle</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.vehicleType && <p className="text-xs text-destructive">{errors.vehicleType.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Year</Label>
                    <Input placeholder="e.g. 2022" maxLength={4} {...register('vehicleYear')} />
                    {errors.vehicleYear && <p className="text-xs text-destructive">{errors.vehicleYear.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Make &amp; Model</Label>
                    <Input placeholder="e.g. Toyota Camry" {...register('vehicleModel')} />
                    {errors.vehicleModel && <p className="text-xs text-destructive">{errors.vehicleModel.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label><User className="inline h-3.5 w-3.5 mr-1" />Your Name</Label>
                    <Input placeholder="John Doe" {...register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label><Mail className="inline h-3.5 w-3.5 mr-1" />Email Address</Label>
                    <Input type="email" placeholder="john@example.com" {...register('email')} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                  Need same-day or express delivery?{' '}
                  <a href="/services/freight" className="text-primary underline">Freight services</a>
                  {' '}or{' '}
                  <a href="/services/delivery" className="text-primary underline">van delivery</a>
                  {' '}may be a better fit.
                </div>

                {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                    : <>Request Quote by Email<ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
