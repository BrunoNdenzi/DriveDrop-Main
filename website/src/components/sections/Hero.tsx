import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Truck, Shield, Clock, MapPin, Star, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-32">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 gradient-mesh opacity-60" />
      
      {/* Floating shapes */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      
      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="space-y-12 animate-slide-up">
            {/* Headline */}
            <div className="space-y-6">
              <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-tight">
                Ship Your Vehicle
                <span className="block text-gradient mt-4">
                  Anywhere. Anytime.
                </span>
              </h1>
              <p className="text-2xl text-muted-foreground max-w-xl leading-relaxed">
                Connect with verified drivers, get instant quotes, and track your vehicle 
                in real-time. The modern way to ship your car.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6">
              <Button 
                asChild 
                size="lg" 
                className="gradient-primary text-xl px-10 py-7 hover-lift group"
              >
                <Link href="/#quote">
                  Get Instant Quote 
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button 
                asChild 
                variant="outline" 
                size="lg"
                className="text-xl px-10 py-7 border-2 border-primary/20 hover:border-primary hover:bg-primary/5"
              >
                <Link href="/#how-it-works">
                  How It Works
                </Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-8 pt-6">
              <div className="flex items-center space-x-3">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      className="w-12 h-12 rounded-full bg-primary/20 border-2 border-white flex items-center justify-center"
                    >
                      <Truck className="w-6 h-6 text-primary" />
                    </div>
                  ))}
                </div>
                <div className="text-base">
                  <div className="font-semibold text-lg">1,000+ Drivers</div>
                  <div className="text-muted-foreground">Verified & Insured</div>
                </div>
              </div>
              
              <div className="h-14 w-px bg-border" />
              
              <div className="flex items-center space-x-3">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-6 h-6 fill-secondary text-secondary" />
                  ))}
                </div>
                <div className="text-base">
                  <div className="font-semibold text-lg">4.9/5 Rating</div>
                  <div className="text-muted-foreground">10,000+ Reviews</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right content - Animated card showcase */}
          <div className="relative hidden lg:block">
            {/* Main card */}
            <div className="glass rounded-3xl p-8 hover-lift">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">Active Shipment</div>
                      <div className="text-sm text-muted-foreground">#SH-2025-1234</div>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                    In Transit
                  </div>
                </div>

                {/* Route */}
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground">From</div>
                      <div className="font-medium">Los Angeles, CA</div>
                    </div>
                  </div>
                  
                  <div className="ml-4 border-l-2 border-dashed border-primary/30 h-12" />
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground">To</div>
                      <div className="font-medium">New York, NY</div>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Progress</span>
                    <span className="font-medium text-primary">68%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full gradient-primary rounded-full" style={{ width: '68%' }} />
                  </div>
                  <div className="text-sm text-muted-foreground">Estimated arrival: 2 days</div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">2,847</div>
                    <div className="text-xs text-muted-foreground">Miles</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-secondary">$1,450</div>
                    <div className="text-xs text-muted-foreground">Total Cost</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">4.9★</div>
                    <div className="text-xs text-muted-foreground">Driver Rating</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating feature cards */}
            <div className="absolute -top-6 -right-6 glass rounded-2xl p-4 animate-float" style={{ animationDelay: '1s' }}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Fully Insured</div>
                  <div className="text-xs text-muted-foreground">Up to $100k</div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-6 glass rounded-2xl p-4 animate-float" style={{ animationDelay: '1.5s' }}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full gradient-secondary flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Instant Quotes</div>
                  <div className="text-xs text-muted-foreground">In 30 seconds</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust indicators - Updated design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
          <div className="glass rounded-2xl p-6 hover-lift group">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-lg">Verified Drivers</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                All drivers undergo thorough background checks, vehicle inspections, and insurance verification
              </p>
            </div>
          </div>
          
          <div className="glass rounded-2xl p-6 hover-lift group">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-lg">Real-Time Tracking</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Track your vehicle's location every step of the way with live GPS updates and notifications
              </p>
            </div>
          </div>
          
          <div className="glass rounded-2xl p-6 hover-lift group">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl gradient-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Truck className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-lg">Instant Quotes</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Get accurate pricing in seconds with our intelligent algorithm - no hidden fees ever
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
