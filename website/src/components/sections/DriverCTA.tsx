import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DollarSign, MapPin, Clock } from 'lucide-react'

export default function DriverCTA() {
  return (
    <section className="py-12">
      <div className="container">
        <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-br from-primary to-blue-600 p-8 text-center text-white md:p-10">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Become a DriveDrop Driver
          </h2>
          <p className="mt-3 text-base opacity-90">
            Earn money by delivering vehicles across the US. Set your own schedule and get paid weekly.
          </p>
          
          <div className="mt-6 grid gap-4 sm:grid-cols-3 text-left">
            <div className="flex items-start space-x-3">
              <DollarSign className="h-6 w-6 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Competitive Pay</h3>
                <p className="text-sm opacity-80">Earn up to 90% of your trip</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Clock className="h-6 w-6 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Flexible Schedule</h3>
                <p className="text-sm opacity-80">Work when you want</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <MapPin className="h-6 w-6 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Nationwide</h3>
                <p className="text-sm opacity-80">Deliver across all 50 states</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button asChild size="lg" variant="secondary">
              <Link href="/drivers/register">Apply to Drive</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
