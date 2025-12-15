import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-muted-foreground mb-6">
            <strong>Last Updated:</strong> October 27, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using DriveDrop's platform, mobile application, or services ("Services"), 
              you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, 
              do not use our Services. These Terms constitute a legally binding agreement between you and DriveDrop, Inc.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Service Description</h2>
            <p className="mb-4">
              DriveDrop is a technology platform that connects vehicle owners ("Shippers") with independent 
              drivers ("Drivers") to facilitate vehicle transportation services.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>We provide a marketplace platform; we do NOT transport vehicles ourselves</li>
              <li>We facilitate connections, payments, and communications between parties</li>
              <li>Drivers are independent contractors, not employees of DriveDrop</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Eligibility</h2>
            <p className="mb-4">To use DriveDrop Services, you must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be at least 18 years of age</li>
              <li>Have legal capacity to enter into contracts</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li><strong>For Drivers:</strong> Have a valid driver's license, insurance, and pass background checks</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Driver Terms</h2>
            <h3 className="text-xl font-semibold mb-3">4.1 Independent Contractor Status</h3>
            <p className="mb-4">
              Drivers are independent contractors. This relationship does NOT create an employment, partnership, 
              joint venture, or agency relationship. You retain complete control over when, where, and whether 
              you accept shipments.
            </p>

            <h3 className="text-xl font-semibold mb-3">4.2 Driver Requirements</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Maintain valid driver's license and auto insurance</li>
              <li>Pass criminal background check and driving record check</li>
              <li>Maintain vehicle in safe, operable condition</li>
              <li>Comply with all traffic laws and regulations</li>
              <li>Provide professional and courteous service</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">4.3 Driver Earnings</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Commission:</strong> Drivers receive 80% of the shipment fee</li>
              <li><strong>Payout Schedule:</strong> Weekly payments via direct deposit</li>
              <li><strong>Fuel Reimbursement:</strong> Included in commission percentage</li>
              <li><strong>Cancellation Penalties:</strong> $25 fee for cancellations within 2 hours of pickup</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Shipper Terms</h2>
            <h3 className="text-xl font-semibold mb-3">5.1 Booking and Payment</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Prices are calculated based on distance, vehicle type, and shipping speed</li>
              <li>Payment is processed through Stripe at time of booking</li>
              <li>A temporary hold is placed on your payment method until delivery completion</li>
              <li>Final charge is processed after successful delivery</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">5.2 Cancellation Policy</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Free Cancellation:</strong> Within 1 hour of booking (before payment capture)</li>
              <li><strong>Partial Refund:</strong> More than 24 hours before pickup (50% refund)</li>
              <li><strong>No Refund:</strong> Within 24 hours of scheduled pickup</li>
              <li><strong>Driver Cancellation:</strong> Full refund if driver cancels</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">5.3 Vehicle Condition</h3>
            <p className="mb-4">You must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate description of vehicle condition</li>
              <li>Remove personal belongings from vehicle</li>
              <li>Ensure vehicle is operable (unless specified otherwise)</li>
              <li>Document vehicle condition with photos before and after transport</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Platform Fees</h2>
            <p className="mb-4">DriveDrop charges the following fees:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Service Fee:</strong> 20% commission on shipment price (paid by shipper, deducted from driver earnings)</li>
              <li><strong>Payment Processing:</strong> Stripe fees (2.9% + $0.30) passed to shipper</li>
              <li><strong>Cancellation Fee:</strong> $25 for driver cancellations within 2 hours of pickup</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Liability and Insurance</h2>
            <h3 className="text-xl font-semibold mb-3">7.1 Driver Liability</h3>
            <p className="mb-4">
              Drivers are responsible for damage to vehicles during transport. DriveDrop is NOT liable 
              for driver actions or negligence. Drivers must maintain adequate auto insurance.
            </p>

            <h3 className="text-xl font-semibold mb-3">7.2 Limitation of Liability</h3>
            <p className="mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DRIVEDROP SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Indirect, incidental, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, data, or use</li>
              <li>Vehicle damage, theft, or loss</li>
              <li>Personal injury or property damage</li>
              <li>Driver misconduct or negligence</li>
            </ul>
            <p className="mt-4">
              <strong>Our total liability is limited to the amount paid for the specific transaction (not to exceed $500).</strong>
            </p>

            <h3 className="text-xl font-semibold mb-3">7.3 Insurance Coverage</h3>
            <p>
              Drivers must maintain their own commercial auto insurance. DriveDrop does NOT provide 
              insurance coverage for vehicles in transit. Shippers should verify coverage with their 
              own insurance providers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Prohibited Conduct</h2>
            <p className="mb-4">You may NOT:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the platform for illegal purposes</li>
              <li>Provide false or misleading information</li>
              <li>Circumvent our payment system (off-platform payments)</li>
              <li>Harass, abuse, or threaten other users</li>
              <li>Transport stolen vehicles or contraband</li>
              <li>Reverse engineer or scrape our platform</li>
              <li>Create multiple accounts or impersonate others</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Dispute Resolution</h2>
            <h3 className="text-xl font-semibold mb-3">9.1 Arbitration Agreement</h3>
            <p className="mb-4">
              Any disputes arising from these Terms or use of Services shall be resolved through binding 
              arbitration, NOT court litigation. You waive your right to jury trial and class action lawsuits.
            </p>

            <h3 className="text-xl font-semibold mb-3">9.2 Informal Resolution</h3>
            <p>
              Before filing arbitration, you agree to attempt informal resolution by contacting 
              <a href="mailto:disputes@drivedrop.us.com" className="text-primary underline"> disputes@drivedrop.us.com</a> 
              and allowing 30 days for resolution.
            </p>

            <h3 className="text-xl font-semibold mb-3">9.3 Governing Law</h3>
            <p>
              These Terms are governed by the laws of [Your State], excluding conflict-of-law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Account Termination</h2>
            <p className="mb-4">We may suspend or terminate your account if you:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violate these Terms or our policies</li>
              <li>Engage in fraudulent activity</li>
              <li>Fail background checks (drivers)</li>
              <li>Receive excessive complaints or negative ratings</li>
            </ul>
            <p className="mt-4">
              You may close your account at any time. Outstanding payments must be settled before closure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Intellectual Property</h2>
            <p>
              All content, trademarks, logos, and intellectual property on the platform are owned by 
              DriveDrop or licensors. You may not use, reproduce, or distribute our IP without written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Modifications</h2>
            <p>
              We may modify these Terms at any time. Material changes will be communicated via email 
              or app notification. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">13. Contact Information</h2>
            <p className="mb-4">For questions about these Terms:</p>
            <ul className="list-none space-y-2">
              <li><strong>Email:</strong> <a href="mailto:legal@drivedrop.us.com" className="text-primary underline">legal@drivedrop.us.com</a></li>
              <li><strong>Mail:</strong> DriveDrop Legal, Charlotte, North Carolina, USA</li>
              <li><strong>Phone:</strong> <a href="tel:+17042662317" className="text-primary underline">+1-704-266-2317</a></li>
            </ul>
          </section>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <p className="text-sm">
              By clicking "I Accept" or using our Services, you acknowledge that you have read, understood, 
              and agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
