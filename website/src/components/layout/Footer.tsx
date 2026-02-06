import Link from 'next/link'
import { Truck, Mail, Phone, MapPin } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-10 md:py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Truck className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">DriveDrop</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vehicle shipping made simple. Ship your vehicle anywhere in the US with trusted drivers.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-3 text-sm font-bold">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#quote" className="text-muted-foreground hover:text-primary">
                  Get Quote
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-muted-foreground hover:text-primary">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/drivers/register" className="text-muted-foreground hover:text-primary">
                  Become a Driver
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/#mobile-app" className="text-muted-foreground hover:text-primary">
                  Mobile App
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-3 text-sm font-bold">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-primary">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/fcra" className="text-muted-foreground hover:text-primary">
                  FCRA Disclosure
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-3 text-sm font-bold">Contact Us</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center space-x-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a href="mailto:infos@drivedrop.us.com" className="hover:text-primary">
                  infos@drivedrop.us.com
                </a>
              </li>
              <li className="flex items-center space-x-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <a href="tel:+17042662317" className="hover:text-primary">
                  +1-704-266-2317
                </a>
              </li>
              <li className="flex items-center space-x-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>United States</span>
              </li>
            </ul>
          </div>
        </div>

        {/* License & Certifications */}
        <div className="mt-6 border-t pt-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col items-center justify-center gap-4 text-sm">
              <div className="flex flex-wrap items-center justify-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="font-semibold text-primary">USDOT:</span>
                  <span className="font-mono">4503929</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="font-semibold text-primary">MC:</span>
                  <span className="font-mono">1521596</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="font-semibold text-primary">FF:</span>
                  <span className="font-mono">70301</span>
                </div>
                <span className="px-3 py-1.5 bg-green-50 text-green-700 font-medium rounded-lg border border-green-200">
                  ✓ Licensed & Insured
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Freight Forwarder • Interstate Carrier • Fully Bonded & Insured
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} DriveDrop. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
