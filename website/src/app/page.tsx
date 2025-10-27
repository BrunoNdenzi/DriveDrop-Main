import Hero from '@/components/sections/Hero'
import QuoteCalculator from '@/components/sections/QuoteCalculator'
import HowItWorks from '@/components/sections/HowItWorks'
import DriverCTA from '@/components/sections/DriverCTA'
import MobileAppSection from '@/components/sections/MobileAppSection'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <QuoteCalculator />
      <HowItWorks />
      <MobileAppSection />
      <DriverCTA />
      <Footer />
    </main>
  )
}
