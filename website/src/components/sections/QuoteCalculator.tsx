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
import { Loader2, ArrowRight, MapPin, Truck, User, Mail, CheckCircle, ArrowLeft, Zap, LayoutDashboard } from 'lucide-react'
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete'
import { pricingService } from '@/services/pricingService'

const detailsSchema = z.object({
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  deliveryLocation: z.string().min(1, 'Delivery location is required'),
  vehicleType: z.enum(['sedan', 'suv', 'truck', 'van', 'motorcycle'], {
    required_error: 'Please select a vehicle type',
  }),
  vehicleYear: z.string().min(4, 'Enter a valid year').regex(/^\d{4}$/, 'Enter a 4-digit year'),
  vehicleModel: z.string().min(1, 'Vehicle model is required'),
})

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Please enter a valid email'),
})

type DetailsFormData = z.infer<typeof detailsSchema>
type ContactFormData = z.infer<typeof contactSchema>

interface QuoteResult {
  total: number
  distance: number
  upfront: number
  remaining: number
}

export default function QuoteCalculator() {
  const [step, setStep] = useState<'details' | 'contact' | 'done'>('details')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [detailsSnapshot, setDetailsSnapshot] = useState<DetailsFormData | null>(null)

  const detailsForm = useForm<DetailsFormData>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { vehicleType: 'sedan', vehicleYear: '', vehicleModel: '' },
  })

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  })

  const selectedVehicleType = detailsForm.watch('vehicleType')

  const handlePickupSelect = (address: string, coordinates: { lat: number; lng: number }) => {
    detailsForm.setValue('pickupLocation', address, { shouldValidate: true })
    setPickupCoords(coordinates)
  }

  const handleDeliverySelect = (address: string, coordinates: { lat: number; lng: number }) => {
    detailsForm.setValue('deliveryLocation', address, { shouldValidate: true })
    setDeliveryCoords(coordinates)
  }

  const onDetailsSubmit = (data: DetailsFormData) => {
    setError(null)
    if (!pickupCoords || !deliveryCoords) {
      setError('Please select both addresses from the autocomplete dropdown')
      return
    }
    try {
      const distance = pricingService.calculateDistance(
        pickupCoords.lat, pickupCoords.lng,
        deliveryCoords.lat, deliveryCoords.lng
      )
      const result = pricingService.calculateQuote({
        vehicleType: data.vehicleType,
        distanceMiles: Math.round(distance),
        isAccidentRecovery: false,
        vehicleCount: 1,
        fuelPricePerGallon: 3.70,
      })
      setQuote({
        total: result.total,
        distance: Math.round(distance),
        upfront: parseFloat((result.total * 0.20).toFixed(2)),
        remaining: parseFloat((result.total * 0.80).toFixed(2)),
      })
      setDetailsSnapshot(data)
      setStep('contact')
    } catch (err) {
      setError('Could not calculate quote for this route. Please try different addresses.')
    }
  }

  const onContactSubmit = async (data: ContactFormData) => {
    if (!detailsSnapshot || !quote) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/quotes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          pickupLocation: detailsSnapshot.pickupLocation,
          deliveryLocation: detailsSnapshot.deliveryLocation,
          vehicleType: detailsSnapshot.vehicleType,
          vehicleYear: detailsSnapshot.vehicleYear,
          vehicleModel: detailsSnapshot.vehicleModel,
          pickupCoords,
          deliveryCoords,
          preCalculatedQuote: quote,
        }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to send quote')
      }
      setStep('done')
    } catch (err) {
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
              <span>📅 Flexible (5+ day window): −5%</span>
              <span>💰 Minimum: $150</span>
              <span>💳 Pay 20% upfront, 80% on delivery</span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {step === 'details' && 'Calculate Your Quote'}
                {step === 'contact' && 'Your Estimated Quote'}
                {step === 'done' && 'Quote Sent!'}
              </CardTitle>
              <CardDescription>
                {step === 'details' && 'Enter shipment details to see your instant price estimate'}
                {step === 'contact' && 'Enter your details and we\'ll email you a full quote'}
                {step === 'done' && 'Check your inbox — your personalized quote is on its way'}
              </CardDescription>
            </CardHeader>
            <CardContent>

              {/* ── STEP: DONE ──────────────────────────────────────── */}
              {step === 'done' && (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Quote Sent!</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    We've emailed your personalized quote. Please check your spam folder if you don't see it within a few minutes.
                  </p>
                  <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => window.location.href = '/signup?role=client'} className="gap-2">
                      Create Account & Book Now
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => { setStep('details'); setQuote(null); detailsForm.reset(); contactForm.reset() }}>
                      Get Another Quote
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STEP: CONTACT (show quote + collect name/email) ──── */}
              {step === 'contact' && quote && detailsSnapshot && (
                <div className="space-y-5">
                  {/* Calculated Quote Display */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Estimated Total</p>
                        <p className="text-3xl font-bold text-blue-700">${quote.total.toFixed(2)}</p>
                        <p className="text-xs text-blue-500 mt-0.5">{quote.distance} miles • Standard 7-10 business days</p>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-gray-600">Pay today: <strong className="text-gray-900">${quote.upfront.toFixed(2)}</strong></div>
                        <div className="text-gray-600">On delivery: <strong className="text-gray-900">${quote.remaining.toFixed(2)}</strong></div>
                      </div>
                    </div>
                    <div className="text-xs text-blue-600 border-t border-blue-200 pt-3">
                      <strong>{detailsSnapshot.vehicleYear} {detailsSnapshot.vehicleModel}</strong> ({detailsSnapshot.vehicleType}) ·{' '}
                      {detailsSnapshot.pickupLocation} → {detailsSnapshot.deliveryLocation}
                    </div>
                  </div>

                  {/* Service Options Highlight */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a href="/services/freight" className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50 hover:border-orange-400 transition-colors">
                      <Zap className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Need it faster?</p>
                        <p className="text-xs text-gray-600">Express & same-day freight services available</p>
                      </div>
                    </a>
                    <a href="/signup?role=client" className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 hover:border-blue-400 transition-colors">
                      <LayoutDashboard className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">DriveDrop TMS</p>
                        <p className="text-xs text-gray-600">Full dashboard — track, manage & automate shipments</p>
                      </div>
                    </a>
                  </div>

                  {/* Contact Form */}
                  <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-4">
                    <p className="text-sm text-gray-600">Enter your details to receive this quote by email:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="name"><User className="inline h-4 w-4 mr-1" />Your Name</Label>
                        <Input id="name" placeholder="John Doe" {...contactForm.register('name')} />
                        {contactForm.formState.errors.name && <p className="text-xs text-destructive">{contactForm.formState.errors.name.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email"><Mail className="inline h-4 w-4 mr-1" />Email Address</Label>
                        <Input id="email" type="email" placeholder="john@example.com" {...contactForm.register('email')} />
                        {contactForm.formState.errors.email && <p className="text-xs text-destructive">{contactForm.formState.errors.email.message}</p>}
                      </div>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <div className="flex gap-3">
                      <Button type="button" variant="outline" onClick={() => setStep('details')} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <Button type="submit" className="flex-1 gap-2" disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Send My Quote by Email
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── STEP: DETAILS ──────────────────────────────────── */}
              {step === 'details' && (
              <form onSubmit={detailsForm.handleSubmit(onDetailsSubmit)} className="space-y-4">
                {/* Pickup Location */}
                <div className="space-y-1.5">
                  <Label><MapPin className="inline h-4 w-4 mr-1" />Pickup Location</Label>
                  <GooglePlacesAutocomplete onSelect={handlePickupSelect} placeholder="Enter pickup address..." />
                  {detailsForm.formState.errors.pickupLocation && <p className="text-xs text-destructive">{detailsForm.formState.errors.pickupLocation.message}</p>}
                </div>

                {/* Delivery Location */}
                <div className="space-y-1.5">
                  <Label><MapPin className="inline h-4 w-4 mr-1" />Delivery Location</Label>
                  <GooglePlacesAutocomplete onSelect={handleDeliverySelect} placeholder="Enter delivery address..." />
                  {detailsForm.formState.errors.deliveryLocation && <p className="text-xs text-destructive">{detailsForm.formState.errors.deliveryLocation.message}</p>}
                </div>

                {/* Vehicle Type + Year */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label><Truck className="inline h-4 w-4 mr-1" />Vehicle Type</Label>
                    <Select value={selectedVehicleType} onValueChange={(v) => detailsForm.setValue('vehicleType', v as any, { shouldValidate: true })}>
                      <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedan">Sedan</SelectItem>
                        <SelectItem value="suv">SUV</SelectItem>
                        <SelectItem value="truck">Truck</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="motorcycle">Motorcycle</SelectItem>
                      </SelectContent>
                    </Select>
                    {detailsForm.formState.errors.vehicleType && <p className="text-xs text-destructive">{detailsForm.formState.errors.vehicleType.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vehicle Year</Label>
                    <Input placeholder="e.g. 2022" maxLength={4} {...detailsForm.register('vehicleYear')} />
                    {detailsForm.formState.errors.vehicleYear && <p className="text-xs text-destructive">{detailsForm.formState.errors.vehicleYear.message}</p>}
                  </div>
                </div>

                {/* Vehicle Model */}
                <div className="space-y-1.5">
                  <Label>Vehicle Make &amp; Model</Label>
                  <Input placeholder="e.g. Toyota Camry, Ford F-150, Custom Build..." {...detailsForm.register('vehicleModel')} />
                  {detailsForm.formState.errors.vehicleModel && <p className="text-xs text-destructive">{detailsForm.formState.errors.vehicleModel.message}</p>}
                </div>

                {/* Express notice */}
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                  Need same-day or express delivery?{' '}
                  <a href="/services/freight" className="text-primary underline">Freight services</a>
                  {' '}or{' '}
                  <a href="/services/delivery" className="text-primary underline">van delivery</a>
                  {' '}may be a better fit.
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" size="lg">
                  Calculate My Quote
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
              )}

            </CardContent>
          </Card>
        </div>
    </section>
  )
}
