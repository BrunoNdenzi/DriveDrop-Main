import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function MobileAppSection() {
  return (
    <section id="mobile-app" className="py-20 bg-muted/50">
      <div className="container">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Download Our Mobile App</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Manage your shipments on the go with our mobile app
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg">
              <a href="https://play.google.com/store" target="_blank" rel="noopener noreferrer">
                Google Play
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer">
                App Store
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
