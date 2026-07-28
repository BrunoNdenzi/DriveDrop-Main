import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import ParkingInterestForm from './parking-interest-form'

export const metadata: Metadata = {
  title: 'Charlotte Commercial Truck Parking Interest',
  description: 'Share your non-binding interest in secure commercial truck and equipment parking near the I-77 corridor in Charlotte.',
}

export default function ParkingInterestPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main>
        <section className="bg-slate-950 px-4 pb-16 pt-32 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-32">
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-teal-400">
                Charlotte, North Carolina
              </p>
              <h1 className="max-w-xl text-4xl font-bold leading-tight sm:text-5xl">
                Help shape a secure commercial parking facility near I-77
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                DriveDrop and Calkons Groups are evaluating demand for fenced, gated, well-lit parking for tractors, trailers, construction equipment, and other commercial vehicles.
              </p>

              <div className="mt-10 border-l-2 border-teal-400 pl-6">
                <p className="font-semibold text-white">This is a non-binding expression of interest.</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  There is no commitment, reservation, or payment. Your response helps us evaluate the location, capacity, pricing, and services local operators actually need.
                </p>
              </div>

              <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-7 border-t border-slate-800 pt-8 text-sm">
                <div>
                  <dt className="text-slate-500">Proposed area</dt>
                  <dd className="mt-1 font-semibold text-slate-100">Charlotte I-77 corridor</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Parking options</dt>
                  <dd className="mt-1 font-semibold text-slate-100">Daily and monthly</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Planned security</dt>
                  <dd className="mt-1 font-semibold text-slate-100">Gated, cameras, LED lighting</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Time to complete</dt>
                  <dd className="mt-1 font-semibold text-slate-100">About 2 minutes</dd>
                </div>
              </dl>
            </div>

            <ParkingInterestForm />
          </div>
        </section>
      </main>
    </div>
  )
}