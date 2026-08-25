'use client'

import Link from 'next/link'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowRight, CheckCircle, LayoutDashboard, Loader2, Mail, MapPin, Truck, User, Zap } from '@/components/icons/streamline-lucide'

import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const quoteSchema = z.object({
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  deliveryLocation: z.string().min(1, 'Delivery location is required'),
  vehicleType: z.enum(['sedan', 'suv', 'truck', 'van', 'motorcycle'], { required_error: 'Please select a vehicle type' }),
  vehicleYear: z.string().min(4, 'Enter a valid year').regex(/^\d{4}$/, 'Enter a 4-digit year'),
  vehicleModel: z.string().min(1, 'Vehicle make and model is required'),
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Please enter a valid email'),
})

type QuoteFormData = z.infer<typeof quoteSchema>

const pricing = [
  { vehicle: 'Sedan', short: '$1.80', mid: '$0.95', long: '$0.60' },
  { vehicle: 'SUV / Van', short: '$2.00', mid: '$1.05', long: '$0.70' },
  { vehicle: 'Truck', short: '$2.20', mid: '$1.15', long: '$0.75' },
  { vehicle: 'Motorcycle', short: '$1.50', mid: '$0.80', long: '$0.50' },
]

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
        body: JSON.stringify({ ...data, pickupCoords, deliveryCoords }),
      })

      if (!response.ok) {
        const responseError = await response.json()
        throw new Error(responseError.error || 'Failed to send quote')
      }

      setSubmitted(true)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to send quote. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="quote" className="scroll-mt-20 border-b border-[#cbd8d6] bg-[#f2f6f5]">
      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-10 sm:py-20 lg:px-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(280px,.72fr)_minmax(0,1.28fr)] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#008c82]">Pricing and quote</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#132c2d] sm:text-4xl">Start with the route. We&apos;ll handle the detail.</h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-[#607675]">Share the vehicle and addresses for a personalized transport quote delivered by email.</p>

            <div className="mt-9 border border-[#c7d4d2] bg-white">
              <div className="border-b border-[#d7e1df] px-4 py-3">
                <h3 className="text-sm font-bold text-[#193638]">Reference rate per mile</h3>
                <p className="mt-0.5 text-xs text-[#718482]">Final pricing reflects route and availability.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
                  <thead className="bg-[#f4f7f6] text-[10px] font-bold uppercase tracking-[0.08em] text-[#657977]">
                    <tr>
                      <th className="w-[31%] px-2 py-2.5 text-left sm:px-4">Vehicle</th>
                      <th className="px-1 py-2.5 text-right sm:px-3">0-500 mi</th>
                      <th className="px-1 py-2.5 text-right sm:px-3">500-1,500</th>
                      <th className="px-2 py-2.5 text-right sm:px-4">1,500+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.map(row => (
                      <tr key={row.vehicle} className="border-t border-[#e0e8e6]">
                        <td className="px-2 py-3 font-semibold text-[#263f40] sm:px-4">{row.vehicle}</td>
                        <td className="px-1 py-3 text-right tabular-nums text-[#405958] sm:px-3">{row.short}</td>
                        <td className="bg-[#edf7f5] px-1 py-3 text-right font-semibold tabular-nums text-[#007b72] sm:px-3">{row.mid}</td>
                        <td className="px-2 py-3 text-right tabular-nums text-[#405958] sm:px-4">{row.long}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-3 border-y border-[#cbd8d6] py-4 text-sm">
              <div><dt className="text-xs text-[#718482]">Minimum</dt><dd className="mt-1 font-semibold text-[#263f40]">$150</dd></div>
              <div className="border-l border-[#cbd8d6] pl-4"><dt className="text-xs text-[#718482]">Flexible window</dt><dd className="mt-1 font-semibold text-[#263f40]">Save 5%</dd></div>
              <div className="border-l border-[#cbd8d6] pl-4"><dt className="text-xs text-[#718482]">At booking</dt><dd className="mt-1 font-semibold text-[#263f40]">20%</dd></div>
            </dl>
          </div>

          <div className="border border-[#c7d4d2] bg-white">
            <div className="border-b border-[#d7e1df] px-5 py-4 sm:px-7">
              <h3 className="text-lg font-semibold text-[#193638]">{submitted ? 'Quote request received' : 'Request your quote'}</h3>
              <p className="mt-1 text-sm text-[#667b79]">{submitted ? 'Your personalized quote is on its way.' : 'Accurate route details produce a better transport estimate.'}</p>
            </div>

            {submitted ? (
              <div className="px-5 py-12 text-center sm:px-7">
                <div className="mx-auto grid h-14 w-14 place-items-center bg-[#eaf7f3] text-[#176c59]"><CheckCircle className="h-7 w-7" /></div>
                <h4 className="mt-5 text-xl font-semibold text-[#193638]">Check your inbox</h4>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667b79]">We emailed your personalized quote. Check your spam folder if it does not arrive within a few minutes.</p>
                <div className="mx-auto mt-7 grid max-w-lg gap-3 sm:grid-cols-2">
                  <Link href="/signup?role=client" className="flex items-center gap-3 border border-[#c7d4d2] p-4 text-left hover:bg-[#f4f8f7]">
                    <LayoutDashboard className="h-5 w-5 shrink-0 text-[#008c82]" />
                    <span><strong className="block text-sm text-[#193638]">Create account</strong><span className="text-xs text-[#718482]">Book and track online</span></span>
                  </Link>
                  <Link href="/services/freight" className="flex items-center gap-3 border border-[#e4c984] bg-[#fff8e8] p-4 text-left hover:bg-[#fff4d8]">
                    <Zap className="h-5 w-5 shrink-0 text-[#9b6200]" />
                    <span><strong className="block text-sm text-[#674700]">Need it faster?</strong><span className="text-xs text-[#806126]">Explore freight options</span></span>
                  </Link>
                </div>
                <button type="button" onClick={() => setSubmitted(false)} className="mt-6 text-sm font-semibold text-[#007b72] hover:underline">Request another quote</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
                <fieldset>
                  <legend className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-[#718482]">Route</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Pickup location" icon={MapPin} error={errors.pickupLocation?.message}>
                      <GooglePlacesAutocomplete onSelect={handlePickupSelect} placeholder="Enter pickup address" />
                    </Field>
                    <Field label="Delivery location" icon={MapPin} error={errors.deliveryLocation?.message}>
                      <GooglePlacesAutocomplete onSelect={handleDeliverySelect} placeholder="Enter delivery address" />
                    </Field>
                  </div>
                </fieldset>

                <fieldset className="border-t border-[#dce5e3] pt-5">
                  <legend className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-[#718482]">Vehicle</legend>
                  <div className="grid gap-4 sm:grid-cols-[.8fr_.65fr_1.35fr]">
                    <Field label="Type" icon={Truck} error={errors.vehicleType?.message}>
                      <Select value={selectedVehicleType} onValueChange={value => setValue('vehicleType', value as QuoteFormData['vehicleType'], { shouldValidate: true })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sedan">Sedan</SelectItem><SelectItem value="suv">SUV</SelectItem><SelectItem value="truck">Truck</SelectItem><SelectItem value="van">Van</SelectItem><SelectItem value="motorcycle">Motorcycle</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Year" error={errors.vehicleYear?.message}><Input placeholder="2022" maxLength={4} {...register('vehicleYear')} /></Field>
                    <Field label="Make and model" error={errors.vehicleModel?.message}><Input placeholder="Toyota Camry" {...register('vehicleModel')} /></Field>
                  </div>
                </fieldset>

                <fieldset className="border-t border-[#dce5e3] pt-5">
                  <legend className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-[#718482]">Contact</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Your name" icon={User} error={errors.name?.message}><Input placeholder="Full name" {...register('name')} /></Field>
                    <Field label="Email address" icon={Mail} error={errors.email?.message}><Input type="email" placeholder="name@example.com" {...register('email')} /></Field>
                  </div>
                </fieldset>

                <div className="border border-[#d7e1df] bg-[#f4f7f6] p-3 text-xs leading-5 text-[#607675]">
                  Same-day move? <Link href="/services/freight" className="font-semibold text-[#007b72] hover:underline">Freight services</Link> or <Link href="/services/delivery" className="font-semibold text-[#007b72] hover:underline">van delivery</Link> may be a better fit.
                </div>

                {error && <p className="border border-[#e5b8b4] bg-[#fff4f3] px-3 py-2 text-sm text-[#9f2f27]" role="alert">{error}</p>}

                <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 bg-[#008c82] px-5 text-sm font-bold text-white hover:bg-[#00756d] disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Sending quote request</> : <>Request quote by email<ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Field({ label, icon: Icon, error, children }: { label: string; icon?: typeof MapPin; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-[#304b4c]">{Icon && <Icon className="mr-1 inline h-3.5 w-3.5" />}{label}</Label>
      {children}
      {error && <p className="text-xs text-[#aa3e35]">{error}</p>}
    </div>
  )
}