import OperationalHero from '@/components/sections/OperationalHero'
import PlatformPreview from '@/components/sections/PlatformPreview'
import LiveMarketData from '@/components/sections/LiveMarketData'
import UserPathways from '@/components/sections/UserPathways'
import CompetitiveAdvantages from '@/components/sections/CompetitiveAdvantages'
import QuoteCalculator from '@/components/sections/QuoteCalculator'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <OperationalHero />
      <PlatformPreview />
      <UserPathways />
      <LiveMarketData />
      <CompetitiveAdvantages />
      <QuoteCalculator />
      <Footer />
    </main>
  )
}
