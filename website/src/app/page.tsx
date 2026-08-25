import OperationalHero from '@/components/sections/OperationalHero'
import UserPathways from '@/components/sections/UserPathways'
import QuoteCalculator from '@/components/sections/QuoteCalculator'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ParkingInterestFloater from '@/components/parking/ParkingInterestFloater'

export default function Home() {
  return (
    <main className="min-h-screen bg-background pt-20">
      <Header />
      <OperationalHero />
      <UserPathways />
      <QuoteCalculator />
      <Footer />
      <ParkingInterestFloater />
    </main>
  )
}
