'use client'

import { FormEvent, useState } from 'react'
import { Check, Loader2, Send } from '@/components/icons/streamline-lucide'

const inputClass = 'mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'
const complianceOptions = ['DBE participation', 'Certified payroll', 'Prevailing wage', 'NCDOT requirements', 'Federal / SAM.gov requirements', 'Daily tickets / load logs']

function earliestServiceDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find(part => part.type === type)?.value || ''
  const easternDate = new Date(`${value('year')}-${value('month')}-${value('day')}T12:00:00Z`)
  const minutes = Number(value('hour')) * 60 + Number(value('minute'))
  easternDate.setUTCDate(easternDate.getUTCDate() + (minutes > 810 ? 2 : 1))
  return easternDate.toISOString().slice(0, 10)
}

export default function DumpTruckBookingForm() {
  const [compliance, setCompliance] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [minimumDate] = useState(earliestServiceDate)

  const toggleCompliance = (item: string) => setCompliance(current => current.includes(item) ? current.filter(value => value !== item) : [...current, item])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())

    try {
      const response = await fetch('/api/dump-truck-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          complianceRequirements: compliance,
          purchaseOrderAvailable: formData.get('purchaseOrderAvailable') === 'true',
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'We could not submit your request.')
      setSubmitted(true)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'We could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <div className="rounded-md bg-white p-8 text-slate-950 shadow-2xl shadow-black/20 sm:p-10" role="status">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700"><Check className="h-6 w-6" aria-hidden="true" /></div>
      <h2 className="mt-6 text-2xl font-bold">Request received.</h2>
      <p className="mt-3 leading-7 text-slate-600">Benji notified our operations team. We will review fleet availability, confirm pricing, and contact you before the request becomes a booked assignment.</p>
      <p className="mt-6 border-t border-slate-200 pt-6 text-sm text-slate-500">Urgent questions? Call 704-266-2317 or email infos@calkons.com.</p>
    </div>
  }

  return <form onSubmit={handleSubmit} className="rounded-md bg-white p-6 text-slate-950 shadow-2xl shadow-black/20 sm:p-10">
    <div className="border-b border-slate-200 pb-6"><p className="text-xs font-bold uppercase tracking-[2px] text-teal-700">Availability request</p><h2 className="mt-2 text-2xl font-bold">Request dump trucks</h2><p className="mt-2 text-sm leading-6 text-slate-600">Fields marked * are required. Submission does not guarantee availability until confirmed in writing.</p></div>

    <fieldset className="mt-7"><legend className="text-sm font-bold text-slate-900">Contact</legend><div className="mt-3 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-800">Requesting as *<select className={inputClass} name="customerType" required defaultValue=""><option value="" disabled>Select one</option>{['Individual','Business','Government agency','Prime contractor','Subcontractor','Other'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-800">Full name *<input className={inputClass} name="fullName" autoComplete="name" maxLength={120} required /></label>
      <label className="text-sm font-semibold text-slate-800">Company / agency<input className={inputClass} name="companyName" autoComplete="organization" maxLength={160} /></label>
      <label className="text-sm font-semibold text-slate-800">Email *<input className={inputClass} name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Phone *<input className={inputClass} name="phone" type="tel" autoComplete="tel" maxLength={30} required /></label>
    </div></fieldset>

    <fieldset className="mt-8 border-t border-slate-200 pt-7"><legend className="text-sm font-bold text-slate-900">Project and schedule</legend><div className="mt-3 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-800">Project type *<select className={inputClass} name="projectType" required defaultValue=""><option value="" disabled>Select one</option>{['NCDOT','State or local government','SAM.gov / federal','Commercial construction','Residential construction','Land development','Other'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-800">Project name<input className={inputClass} name="projectName" maxLength={180} /></label>
      <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Solicitation, contract, PO, or project number<input className={inputClass} name="solicitationNumber" maxLength={120} /></label>
      <label className="text-sm font-semibold text-slate-800">Trucks needed *<input className={inputClass} name="trucksNeeded" type="number" min="1" max="100" inputMode="numeric" required /></label>
      <label className="text-sm font-semibold text-slate-800">Service date *<input className={inputClass} name="serviceDate" type="date" min={minimumDate} required /><span className="mt-1.5 block text-xs font-normal text-slate-500">Book by 1:30 PM ET on the preceding day.</span></label>
      <label className="text-sm font-semibold text-slate-800">Start time *<input className={inputClass} name="startTime" type="time" required /></label>
      <label className="text-sm font-semibold text-slate-800">Duration *<select className={inputClass} name="duration" required defaultValue=""><option value="" disabled>Select one</option>{['Up to 4 hours','Full day','Multiple days','Ongoing / recurring','Not sure yet'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Estimated number of days<input className={inputClass} name="estimatedDays" type="number" min="1" max="365" inputMode="numeric" /></label>
    </div></fieldset>

    <fieldset className="mt-8 border-t border-slate-200 pt-7"><legend className="text-sm font-bold text-slate-900">Hauling scope</legend><div className="mt-3 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Job site / pickup address *<input className={inputClass} name="jobSiteAddress" autoComplete="street-address" maxLength={300} required /></label>
      <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Dump site / delivery address<input className={inputClass} name="dumpSiteAddress" maxLength={300} /></label>
      <label className="text-sm font-semibold text-slate-800">Material *<select className={inputClass} name="materialType" required defaultValue=""><option value="" disabled>Select one</option>{['Dirt / soil','Aggregate / stone','Asphalt','Concrete','Demolition debris','Clearing debris','Other'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-800">Estimated loads per truck / day<input className={inputClass} name="estimatedLoadsPerDay" type="number" min="1" max="1000" inputMode="numeric" /></label>
      <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Loading equipment / method<input className={inputClass} name="loadingMethod" maxLength={160} placeholder="Excavator, loader, plant, crew loading, or unknown" /></label>
    </div></fieldset>

    <fieldset className="mt-8 border-t border-slate-200 pt-7"><legend className="text-sm font-bold text-slate-900">Compliance and site requirements</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{complianceOptions.map(item => <label key={item} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-teal-500"><input type="checkbox" checked={compliance.includes(item)} onChange={() => toggleCompliance(item)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600" />{item}</label>)}</div></fieldset>

    <label className="mt-6 block text-sm font-semibold text-slate-800">Access, PPE, safety, ticketing, or site instructions<textarea className={`${inputClass} min-h-24 resize-y`} name="siteRequirements" maxLength={2000} /></label>
    <label className="mt-6 block text-sm font-semibold text-slate-800">Additional scope details<textarea className={`${inputClass} min-h-28 resize-y`} name="additionalDetails" maxLength={3000} placeholder="Include route, shift schedule, standby expectations, material estimates, and anything needed for an accurate quote." /></label>
    <label className="mt-6 flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" name="purchaseOrderAvailable" value="true" className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600" /><span>A purchase order or written authorization is available.</span></label>
    <label className="sr-only" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-600"><input type="checkbox" name="contactConsent" value="true" required className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600" /><span>I confirm these details are accurate and authorize DriveDrop / Calkons Groups LLC to contact me about this request. *</span></label>
    {error && <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
    <button type="submit" disabled={submitting} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{submitting ? 'Sending request...' : 'Request trucks and pricing'}</button>
  </form>
}
