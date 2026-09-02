import type { Metadata } from 'next'
import ServicesHeader from '@/components/layout/ServicesHeader'
import Footer from '@/components/layout/Footer'
import { Briefcase, Clock, MapPin, ShieldCheck, Truck } from '@/components/icons/streamline-lucide'
import DumpTruckBookingForm from './DumpTruckBookingForm'

export const metadata: Metadata = {
  title: 'Dump Truck Services | DriveDrop',
  description: 'Request dump trucks for NCDOT, government, commercial, development, and private hauling projects in the Charlotte region.',
}

export default function DumpTruckServicesPage() {
  return <main className="min-h-screen bg-slate-50">
    <ServicesHeader />
    <section className="bg-[#102829] px-4 pb-16 pt-32 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
        <div className="lg:sticky lg:top-28">
          <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[3px] text-amber-400"><Truck className="h-4 w-4" />Dump truck capacity</div>
          <h1 className="max-w-xl text-5xl font-black leading-[0.96] tracking-tight sm:text-6xl">Trucks scheduled around the work.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">Request one truck or a coordinated fleet for public works, site development, construction, debris, soil, aggregate, asphalt, and recurring hauling.</p>

          <div className="mt-8 border-l-2 border-amber-400 pl-5"><p className="font-bold text-white">Advance booking cutoff</p><p className="mt-1.5 text-sm leading-6 text-slate-400">Submit by 1:30 PM Eastern Time on the calendar day before service. Earlier requests are strongly recommended for multiple trucks and multi-day work.</p></div>

          <dl className="mt-10 grid grid-cols-2 gap-x-5 gap-y-7 border-t border-white/10 pt-8 text-sm">
            <div><dt className="flex items-center gap-2 text-slate-500"><Truck className="h-4 w-4 text-amber-400" />Capacity</dt><dd className="mt-1.5 font-bold text-white">1 to multi-truck requests</dd></div>
            <div><dt className="flex items-center gap-2 text-slate-500"><MapPin className="h-4 w-4 text-amber-400" />Service area</dt><dd className="mt-1.5 font-bold text-white">Project-specific routing</dd></div>
            <div><dt className="flex items-center gap-2 text-slate-500"><Briefcase className="h-4 w-4 text-amber-400" />Projects</dt><dd className="mt-1.5 font-bold text-white">Public and private</dd></div>
            <div><dt className="flex items-center gap-2 text-slate-500"><ShieldCheck className="h-4 w-4 text-amber-400" />Business status</dt><dd className="mt-1.5 font-bold text-white">DBE certified</dd></div>
          </dl>

          <div className="mt-10 flex items-center gap-3 border-t border-white/10 pt-7 text-sm text-slate-400"><Clock className="h-5 w-5 text-teal-400" /><span>Operations review every request before written confirmation.</span></div>
        </div>
        <DumpTruckBookingForm />
      </div>
    </section>
    <section className="bg-white px-4 py-14 sm:px-6"><div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
      <div><p className="text-xs font-bold uppercase tracking-[2px] text-teal-700">01 / Scope</p><h2 className="mt-3 text-xl font-bold text-slate-950">Tell us what moves</h2><p className="mt-2 text-sm leading-6 text-slate-600">Material, loading method, addresses, estimated loads, site controls, and shift details drive the operating plan.</p></div>
      <div><p className="text-xs font-bold uppercase tracking-[2px] text-teal-700">02 / Compliance</p><h2 className="mt-3 text-xl font-bold text-slate-950">Match project requirements</h2><p className="mt-2 text-sm leading-6 text-slate-600">Flag NCDOT, federal, certified payroll, prevailing wage, DBE, ticketing, PPE, and reporting requirements up front.</p></div>
      <div><p className="text-xs font-bold uppercase tracking-[2px] text-teal-700">03 / Confirmation</p><h2 className="mt-3 text-xl font-bold text-slate-950">Receive a reviewed quote</h2><p className="mt-2 text-sm leading-6 text-slate-600">The request alerts operations by email and SMS. Pricing and fleet availability are confirmed in writing before dispatch.</p></div>
    </div></section>
    <Footer />
  </main>
}
