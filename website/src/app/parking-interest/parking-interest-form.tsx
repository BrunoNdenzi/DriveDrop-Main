'use client'

import { FormEvent, useState } from 'react'
import { Check, Loader2, Send } from 'lucide-react'

const vehicleOptions = [
  'Tractor',
  'Trailer',
  'Box truck',
  'Construction equipment',
  'Other commercial vehicle',
]

const inputClass = 'mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'

export default function ParkingInterestForm() {
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const toggleVehicle = (vehicle: string) => {
    setSelectedVehicles(current =>
      current.includes(vehicle)
        ? current.filter(item => item !== vehicle)
        : [...current, vehicle]
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (selectedVehicles.length === 0) {
      setError('Select at least one vehicle or equipment type.')
      return
    }

    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())

    try {
      const response = await fetch('/api/parking-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, vehicleTypes: selectedVehicles }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'We could not submit your response. Please try again.')
      }

      setSubmitted(true)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'We could not submit your response. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-md bg-white p-8 text-slate-950 shadow-2xl shadow-black/20 sm:p-10" role="status">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <Check className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">Thank you for sharing your needs.</h2>
        <p className="mt-3 leading-7 text-slate-600">
          Your response has been recorded. Our team may contact you to learn more as the Charlotte parking plan develops.
        </p>
        <p className="mt-6 border-t border-slate-200 pt-6 text-sm text-slate-500">
          Questions? Call 704-266-2317 or email infos@calkons.com.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md bg-white p-6 text-slate-950 shadow-2xl shadow-black/20 sm:p-10">
      <div className="border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold">Parking interest survey</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Fields marked with * are required.</p>
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-800">
          Full name *
          <input className={inputClass} name="fullName" autoComplete="name" maxLength={120} required />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Company name *
          <input className={inputClass} name="companyName" autoComplete="organization" maxLength={160} required />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Work email *
          <input className={inputClass} name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Phone number *
          <input className={inputClass} name="phone" type="tel" autoComplete="tel" maxLength={30} required />
        </label>
        <label className="text-sm font-semibold text-slate-800 sm:col-span-2">
          Company type
          <select className={inputClass} name="companyType" defaultValue="">
            <option value="">Select one</option>
            <option value="Trucking company">Trucking company</option>
            <option value="Owner-operator">Owner-operator</option>
            <option value="Construction business">Construction business</option>
            <option value="Fleet operator">Fleet operator</option>
            <option value="Other">Other</option>
          </select>
        </label>
      </div>

      <fieldset className="mt-8 border-t border-slate-200 pt-7">
        <legend className="text-sm font-semibold text-slate-800">Vehicle or equipment type *</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {vehicleOptions.map(vehicle => (
            <label key={vehicle} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-teal-500">
              <input
                type="checkbox"
                checked={selectedVehicles.includes(vehicle)}
                onChange={() => toggleVehicle(vehicle)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
              />
              {vehicle}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-800">
          Number of spaces needed *
          <input className={inputClass} name="spacesNeeded" type="number" min="1" max="500" inputMode="numeric" required />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Parking frequency *
          <select className={inputClass} name="parkingFrequency" defaultValue="" required>
            <option value="" disabled>Select one</option>
            <option value="Monthly">Monthly</option>
            <option value="Daily">Daily</option>
            <option value="Both daily and monthly">Both daily and monthly</option>
            <option value="Not sure yet">Not sure yet</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Preferred monthly price range *
          <select className={inputClass} name="monthlyPriceRange" defaultValue="" required>
            <option value="" disabled>Select one</option>
            <option value="Under $150">Under $150 per space</option>
            <option value="$150-$199">$150-$199 per space</option>
            <option value="$200-$249">$200-$249 per space</option>
            <option value="$250-$299">$250-$299 per space</option>
            <option value="$300 or more">$300 or more per space</option>
            <option value="Need more information">Need more information</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-800">
          When would you need parking? *
          <select className={inputClass} name="neededBy" defaultValue="" required>
            <option value="" disabled>Select one</option>
            <option value="Immediately">Immediately</option>
            <option value="Within 30 days">Within 30 days</option>
            <option value="Within 1-3 months">Within 1-3 months</option>
            <option value="Within 3-6 months">Within 3-6 months</option>
            <option value="More than 6 months">More than 6 months</option>
            <option value="Planning ahead">Planning ahead</option>
          </select>
        </label>
      </div>

      <label className="mt-6 block text-sm font-semibold text-slate-800">
        Additional services or facility needs
        <textarea
          className={`${inputClass} min-h-28 resize-y`}
          name="requestedServices"
          maxLength={1500}
          placeholder="Examples: reserved spaces, 24/7 access, trailer storage, maintenance, wash station, or driver amenities"
        />
      </label>

      <label className="sr-only" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <label className="mt-6 flex items-start gap-3 text-sm leading-6 text-slate-600">
        <input type="checkbox" name="contactConsent" value="true" required className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600" />
        <span>I understand this is non-binding and agree that DriveDrop or Calkons Groups may contact me about this proposed parking facility. *</span>
      </label>

      {error && (
        <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className="h-5 w-5" aria-hidden="true" />}
        {submitting ? 'Submitting response...' : 'Submit non-binding interest'}
      </button>
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">We use your information only to evaluate parking demand and follow up about this project.</p>
    </form>
  )
}