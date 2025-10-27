import Link from 'next/link'
import { ArrowRight, Truck, Shield, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white py-20 sm:py-28">
      <div className="container relative z-10">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Vehicle Shipping{' '}
            <span className="text-primary">Made Simple</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Ship your vehicle anywhere in the US with trusted, verified drivers.
            Get instant quotes, track in real-time, and enjoy hassle-free delivery.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild size="lg">
              <Link href="/#quote">
                Get Instant Quote <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/#mobile-app">Download App</Link>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Verified Drivers</h3>
              <p className="text-sm text-muted-foreground">
                All drivers are background-checked and insured
              </p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Real-Time Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Track your vehicle every step of the way
              </p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Instant Quotes</h3>
              <p className="text-sm text-muted-foreground">
                Get accurate pricing in seconds, no hidden fees
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
