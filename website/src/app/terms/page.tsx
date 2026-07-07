import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container pt-20 py-10 max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Terms of Service</h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-muted-foreground mb-6">
            <strong>Last Updated:</strong> July 7, 2026 &nbsp;|&nbsp; <strong>Effective:</strong> July 7, 2026
          </p>

          {/* ─── 1. Acceptance ─────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4">
              By accessing or using DriveDrop's website, mobile application, or any related services
              (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms")
              and our <a href="/privacy" className="text-primary underline">Privacy Policy</a>, which is
              incorporated herein by reference. If you do not agree to these Terms, do not use our Services.
            </p>
            <p>
              These Terms constitute a legally binding agreement between you and DriveDrop, Inc.
              ("DriveDrop," "we," "us," or "our"), a company headquartered in Charlotte, North Carolina.
              We may update these Terms at any time; material changes will be communicated by email or
              in-app notification. Continued use after the effective date of revised Terms constitutes
              acceptance.
            </p>
          </section>

          {/* ─── 2. Service Description ────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Service Description</h2>
            <p className="mb-4">
              DriveDrop is a technology platform that connects vehicle owners ("Clients" or "Shippers")
              with independent drivers ("Drivers") to facilitate vehicle transportation services across
              the United States.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>DriveDrop provides a marketplace platform; we do <strong>not</strong> transport vehicles ourselves.</li>
              <li>We facilitate booking, payment processing, real-time tracking, and communications between Clients and Drivers.</li>
              <li>Drivers are independent contractors, not employees or agents of DriveDrop.</li>
              <li>
                <strong>Benji AI Assistant:</strong> Our AI-powered assistant ("Benji") helps Clients get
                quotes, book shipments, track deliveries, and manage their account. Benji is a convenience
                tool — it does not replace human judgment and may make errors. See Section 14 for AI
                limitations and responsibilities.
              </li>
            </ul>
          </section>

          {/* ─── 3. Eligibility ────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Eligibility</h2>
            <p className="mb-4">To use DriveDrop Services, you must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be at least 18 years of age.</li>
              <li>Have the legal capacity to enter into binding contracts.</li>
              <li>Provide accurate, complete, and current registration information.</li>
              <li>Maintain the security of your account credentials.</li>
              <li>
                <strong>Drivers additionally must:</strong> hold a valid driver's license, maintain
                adequate auto insurance, and successfully pass DriveDrop's background check and driving
                record review before accepting any shipment.
              </li>
            </ul>
          </section>

          {/* ─── 4. Booking Workflow ───────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Booking Workflow</h2>
            <p className="mb-4">
              The following steps constitute the complete booking process. A shipment is not confirmed
              until all steps are completed.
            </p>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                <strong>Quote:</strong> Submit vehicle details (make, model, year, condition), pickup
                location, destination, and preferred delivery window. DriveDrop's pricing engine
                generates a binding quote. Quotes factor in vehicle type, distance, delivery speed
                (expedited, standard, or flexible), and carrier type (open or enclosed transport).
              </li>
              <li>
                <strong>Terms Acceptance:</strong> Review and explicitly accept these Terms of Service
                and the <a href="/privacy" className="text-primary underline">Privacy Policy</a>. You
                may also accept via Benji AI by typing "I agree" or equivalent. Acceptance is logged
                with a timestamp for your records.
              </li>
              <li>
                <strong>Shipment Creation &amp; 20% Deposit:</strong> Upon acceptance, your shipment is
                created in our system and a 20% deposit is charged to your payment method through Stripe.
                This deposit is non-refundable except as specified in Section 8 (Cancellation Policy).
              </li>
              <li>
                <strong>Driver Assignment:</strong> DriveDrop or an administrator matches and assigns a
                qualified Driver to your shipment. You will be notified by email and/or SMS when a Driver
                is assigned.
              </li>
              <li>
                <strong>Pickup &amp; Delivery:</strong> The Driver contacts you near pickup time. Both
                parties document the vehicle condition at pickup via DriveDrop's verification workflow.
                The Driver delivers the vehicle to the specified address.
              </li>
              <li>
                <strong>Delivery Confirmation &amp; Final Payment:</strong> Upon confirmed delivery, the
                remaining 80% of the shipment fee is charged to your payment method on file. You will
                receive a delivery receipt and invoice by email.
              </li>
            </ol>
          </section>

          {/* ─── 5. Pricing & Quotes ──────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Pricing &amp; Quote Acceptance</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Quotes are generated based on distance, vehicle type, delivery timeline, and carrier
                type at the time of request. Prices are in USD.
              </li>
              <li>
                <strong>Delivery Speed:</strong> Expedited delivery (arrival within 1–4 days of pickup)
                carries a +25% surcharge. Flexible delivery (6 or more days) qualifies for a 5%
                discount. Standard delivery applies the base rate.
              </li>
              <li>
                <strong>Enclosed Transport:</strong> Enclosed carrier (for luxury, classic, or
                high-value vehicles) carries a +30% surcharge over the open-carrier base price.
              </li>
              <li>
                A quote is valid for the session in which it is generated. DriveDrop reserves the right
                to adjust pricing if vehicle information provided proves materially inaccurate (e.g.,
                non-operable vehicle listed as operable, or incorrect vehicle class).
              </li>
              <li>
                <strong>DriveDrop's platform fee is 20%</strong> of the total shipment price, which is
                deducted from Driver earnings. Clients are not charged a separate platform fee; the
                quoted price is the total amount charged.
              </li>
            </ul>
          </section>

          {/* ─── 6. Payment ───────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Payment</h2>
            <h3 className="text-xl font-semibold mb-3">6.1 Payment Processing</h3>
            <p className="mb-4">
              All payments are processed securely through Stripe, Inc. By providing your payment
              information you authorize DriveDrop and Stripe to charge your payment method as described
              below. DriveDrop does <strong>not</strong> store full card numbers; payment data is held
              by Stripe in accordance with PCI-DSS standards.
            </p>
            <h3 className="text-xl font-semibold mb-3">6.2 Two-Stage Payment</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>
                <strong>20% Deposit at Booking:</strong> Charged immediately upon booking confirmation
                to reserve your shipment and secure Driver assignment.
              </li>
              <li>
                <strong>80% Final Payment on Delivery:</strong> The remaining balance is charged
                automatically upon confirmed delivery of your vehicle. This charge uses the same
                payment method unless updated before delivery.
              </li>
              <li>You will receive itemized receipts and invoices for both charges by email.</li>
            </ul>
            <h3 className="text-xl font-semibold mb-3">6.3 Failed Payments</h3>
            <p>
              If the final 80% payment fails (e.g., insufficient funds, expired card), DriveDrop will
              attempt to notify you by email and SMS. Delivery confirmation may be withheld until
              payment is resolved. Persistent non-payment may result in account suspension and
              referral to collections.
            </p>
          </section>

          {/* ─── 7. Driver Assignment ─────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Driver Assignment &amp; Tracking</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                DriveDrop assigns Drivers based on availability, proximity, and qualifications. We do
                not guarantee assignment within a specific timeframe, though we aim to assign within
                24–48 hours of booking.
              </li>
              <li>
                Clients may view the assigned Driver's name and contact details through the platform
                once assignment is confirmed.
              </li>
              <li>
                Real-time GPS tracking of the Driver's location is available during active transport
                through the DriveDrop web and mobile applications.
              </li>
              <li>
                DriveDrop will notify Clients by email and/or SMS at key shipment milestones: booking
                confirmation, driver assignment, pickup confirmation, and delivery.
              </li>
            </ul>
          </section>

          {/* ─── 8. Cancellation Policy ───────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Cancellation &amp; Refund Policy</h2>
            <h3 className="text-xl font-semibold mb-3">8.1 Client Cancellations</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>
                <strong>48+ hours before scheduled pickup:</strong> Full refund of the 20% deposit,
                minus a 10% processing fee.
              </li>
              <li>
                <strong>24–48 hours before scheduled pickup:</strong> 50% refund of the 20% deposit.
              </li>
              <li>
                <strong>Less than 24 hours before scheduled pickup:</strong> No refund. The 20% deposit
                is forfeited.
              </li>
            </ul>
            <h3 className="text-xl font-semibold mb-3">8.2 Driver or Platform Cancellations</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>
                If DriveDrop or the assigned Driver cancels before pickup: full refund of the 20%
                deposit, no cancellation fee.
              </li>
              <li>
                If the Driver identifies a material discrepancy at pickup (e.g., vehicle is
                non-operable when listed as operable, or is not the vehicle described): the booking
                may be cancelled and the Client refunded in full at DriveDrop's discretion.
              </li>
            </ul>
            <h3 className="text-xl font-semibold mb-3">8.3 Modifications</h3>
            <p>
              After booking, modifications to pickup/delivery address or vehicle details must be
              requested through the DriveDrop platform or by contacting support. Modifications that
              materially change the shipment cost may result in a revised quote and require
              re-acceptance. DriveDrop does not guarantee that modifications can be accommodated once
              a Driver has been assigned.
            </p>
            <h3 className="text-xl font-semibold mb-3">8.4 Refund Processing</h3>
            <p>
              Approved refunds are returned to the original payment method within 5–10 business days,
              subject to your card issuer's processing times.
            </p>
          </section>

          {/* ─── 9. Client Responsibilities ───────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Client Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate vehicle make, model, year, VIN (if requested), and condition.</li>
              <li>
                Upload clear, unobstructed photos documenting your vehicle's condition before transport,
                as prompted by the platform. These photos are processed and stored by DriveDrop.
              </li>
              <li>Ensure the vehicle is accessible and ready for pickup at the scheduled time and location.</li>
              <li>Remove all personal belongings, toll transponders, parking passes, and non-standard accessories from the vehicle before pickup.</li>
              <li>Provide valid proof of ownership or authority to ship the vehicle upon request.</li>
              <li>Be present (or have an authorized representative present) at pickup and delivery to sign condition reports.</li>
              <li>Report any damage within <strong>24 hours of delivery</strong> through the DriveDrop platform. Damage reported after this window may not qualify for a claim.</li>
            </ul>
          </section>

          {/* ─── 10. Driver Responsibilities ──────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Driver Responsibilities</h2>
            <h3 className="text-xl font-semibold mb-3">10.1 Independent Contractor Status</h3>
            <p className="mb-4">
              Drivers are independent contractors. This relationship does not create an employment,
              partnership, joint venture, or agency relationship with DriveDrop. Drivers retain full
              control over which shipments they accept.
            </p>
            <h3 className="text-xl font-semibold mb-3">10.2 Requirements</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Maintain a valid, unrestricted driver's license and personal or commercial auto insurance at all times.</li>
              <li>Pass and maintain compliance with DriveDrop's background check and driving record requirements.</li>
              <li>Transport only the vehicle described in the booking; do not allow additional passengers or cargo.</li>
              <li>Complete the pickup and delivery condition report through the DriveDrop platform.</li>
              <li>Comply with all applicable traffic laws, DOT regulations, and DriveDrop operational guidelines.</li>
              <li>Communicate proactively with DriveDrop and the Client regarding delays or issues.</li>
            </ul>
            <h3 className="text-xl font-semibold mb-3">10.3 Earnings</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Drivers receive 80%</strong> of the total shipment fee upon confirmed delivery.</li>
              <li>Earnings are paid out according to DriveDrop's payout schedule. See your driver dashboard for current payout timing.</li>
              <li>DriveDrop retains a 20% platform fee to cover operations, insurance, payment processing, and support.</li>
            </ul>
          </section>

          {/* ─── 11. SMS Communications ───────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. SMS Communications &amp; Consent</h2>
            <p className="mb-4">
              DriveDrop uses SMS messaging (delivered via Twilio) to send operational and transactional
              notifications related to your account and shipments. By providing your mobile phone number
              and creating an account or booking a shipment, you expressly consent to receive SMS
              messages from DriveDrop at the number provided.
            </p>
            <h3 className="text-xl font-semibold mb-3">11.1 Types of SMS Messages</h3>
            <p className="mb-2">DriveDrop may send SMS messages for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Shipment booking confirmations</li>
              <li>Driver assignment notifications</li>
              <li>Pickup and delivery status updates</li>
              <li>Payment notifications (deposit confirmation, final charge, refunds)</li>
              <li>Verification codes (2FA / OTP) for account security</li>
              <li>Customer support responses and operational communications</li>
            </ul>
            <h3 className="text-xl font-semibold mb-3">11.2 SMS Terms</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Message frequency:</strong> Varies based on your account activity and shipment status. Typically 2–10 messages per active shipment.</li>
              <li><strong>Message and data rates may apply.</strong> Check with your mobile carrier for applicable rates.</li>
              <li><strong>Opt-out:</strong> Reply <strong>STOP</strong> to any DriveDrop SMS to unsubscribe from non-critical messages. You may continue to receive essential security and account messages.</li>
              <li><strong>Help:</strong> Reply <strong>HELP</strong> for assistance or contact <a href="mailto:support@drivedrop.us.com" className="text-primary underline">support@drivedrop.us.com</a>.</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mt-4">
              <p className="text-sm font-semibold text-amber-800">
                SMS consent is <strong>not</strong> shared with third parties for marketing or promotional purposes.
                You will only receive messages from DriveDrop, Inc.
              </p>
            </div>
          </section>

          {/* ─── 12. Liability & Insurance ────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Liability &amp; Insurance</h2>
            <h3 className="text-xl font-semibold mb-3">12.1 Driver Liability</h3>
            <p className="mb-4">
              Drivers are solely responsible for damage to vehicles in their care during transport.
              DriveDrop is not liable for driver actions, negligence, or accidents. Drivers must
              maintain adequate auto insurance as a condition of using the platform.
            </p>
            <h3 className="text-xl font-semibold mb-3">12.2 Cargo Insurance</h3>
            <p className="mb-4">
              DriveDrop carries cargo insurance covering up to <strong>$100,000 per vehicle</strong>
              for verifiable transport-related damage caused by Driver negligence. Coverage requires
              completion of the pre-and post-transport photo verification process. Coverage does not
              apply to pre-existing damage, acts of God, or damage caused by the Client's failure to
              disclose vehicle condition accurately.
            </p>
            <h3 className="text-xl font-semibold mb-3">12.3 Limitation of Liability</h3>
            <p className="mb-4 uppercase font-semibold text-sm">
              To the maximum extent permitted by applicable law, DriveDrop shall not be liable for
              indirect, incidental, special, consequential, exemplary, or punitive damages, including
              but not limited to loss of profits, revenue, data, goodwill, or use, arising out of or
              in connection with these Terms or the Services, even if DriveDrop has been advised of
              the possibility of such damages.
            </p>
            <p>
              <strong>DriveDrop's total aggregate liability for any claim arising from a specific
              transaction is limited to the amount paid by the Client for that transaction.</strong>
            </p>
          </section>

          {/* ─── 13. Prohibited Conduct ───────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">13. Prohibited Conduct</h2>
            <p className="mb-4">You may not use DriveDrop Services to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Transport stolen, salvage-titled (without disclosure), or fraudulently misrepresented vehicles.</li>
              <li>Conceal contraband, illegal substances, or unauthorized cargo inside a vehicle being shipped.</li>
              <li>Provide false or materially inaccurate vehicle information, identity, or payment details.</li>
              <li>Circumvent or attempt to bypass DriveDrop's payment system (e.g., arranging off-platform payments to Drivers).</li>
              <li>Harass, threaten, or abuse Drivers, Clients, or DriveDrop personnel.</li>
              <li>Create multiple accounts to circumvent suspensions or exploit promotions.</li>
              <li>Reverse-engineer, scrape, or attempt to extract proprietary data from the DriveDrop platform.</li>
              <li>Use automated bots or scripts to interact with the Services without written authorization.</li>
            </ul>
            <p className="mt-4">
              Violations may result in immediate account suspension, legal action, and forfeiture of
              any pending payments.
            </p>
          </section>

          {/* ─── 14. Benji AI Assistant ───────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">14. Benji AI Assistant — Limitations &amp; Responsibilities</h2>
            <p className="mb-4">
              DriveDrop's AI assistant ("Benji") uses large language models (including GPT-4o and
              GPT-4o-mini from OpenAI) to assist with quoting, booking, tracking, and answering
              questions. By using Benji, you acknowledge:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>AI Accuracy:</strong> Benji may make errors, misunderstand context, or provide
                outdated information. Always confirm critical booking details (price, dates, addresses)
                in the DriveDrop dashboard before completing payment.
              </li>
              <li>
                <strong>Not Legal or Financial Advice:</strong> Responses from Benji do not constitute
                legal, financial, or professional advice.
              </li>
              <li>
                <strong>Document Processing:</strong> Benji can process photos and documents you submit
                (e.g., vehicle title, VIN plate, insurance card, BOL) to extract relevant information
                for your shipment. You are responsible for the accuracy of submitted documents.
                Extracted information is subject to our Privacy Policy.
              </li>
              <li>
                <strong>Booking via Benji:</strong> Bookings initiated through Benji are subject to the
                same Terms as bookings made through the standard web or mobile interface. Benji will
                present these Terms and require explicit acceptance before creating any shipment.
              </li>
              <li>
                <strong>Conversations may be reviewed</strong> by DriveDrop for quality assurance,
                safety, and model improvement purposes, consistent with our Privacy Policy.
              </li>
            </ul>
          </section>

          {/* ─── 15. Uploaded Documents & Photos ──────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">15. Uploaded Documents &amp; Photos</h2>
            <p className="mb-4">
              DriveDrop may request or accept uploaded photos and documents for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Pre- and post-transport vehicle condition photos (required for damage claims)</li>
              <li>Vehicle title, registration, or proof of ownership (for verification)</li>
              <li>Driver's license, insurance certificate, and CDL documentation (Drivers)</li>
              <li>Bill of Lading (BOL) generation and signing</li>
              <li>Damage documentation submitted after delivery</li>
            </ul>
            <p className="mb-4">
              By uploading documents and photos, you:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Represent that you have the right to share the document.</li>
              <li>Grant DriveDrop a limited license to process, store, and use the document for the purpose for which it was submitted.</li>
              <li>Acknowledge that documents may be processed by Benji AI for data extraction (see Section 14).</li>
              <li>Accept responsibility for the accuracy of the information contained in uploaded documents.</li>
            </ul>
          </section>

          {/* ─── 16. Account Termination ──────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">16. Account Termination</h2>
            <p className="mb-4">
              DriveDrop may suspend or permanently terminate your account — with or without prior
              notice — if you:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Violate any provision of these Terms or our policies.</li>
              <li>Engage in fraudulent, abusive, or illegal activity.</li>
              <li>Fail to maintain required Driver credentials or pass re-screening.</li>
              <li>Receive repeated unresolved complaints or maintain an unacceptably low rating.</li>
            </ul>
            <p>
              You may close your account at any time through account settings or by contacting support.
              Outstanding payment obligations must be settled before closure. Upon termination, your
              access to the platform ceases; your data is handled per our Privacy Policy and applicable
              data-retention requirements.
            </p>
          </section>

          {/* ─── 17. Intellectual Property ────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">17. Intellectual Property</h2>
            <p>
              All content, trademarks, logos, software, and other intellectual property displayed on or
              through the DriveDrop platform are owned by DriveDrop, Inc. or its licensors and are
              protected by applicable copyright, trademark, and other intellectual property laws. You
              may not use, reproduce, distribute, or create derivative works without DriveDrop's prior
              written consent.
            </p>
          </section>

          {/* ─── 18. Dispute Resolution ───────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">18. Dispute Resolution</h2>
            <h3 className="text-xl font-semibold mb-3">18.1 Informal Resolution</h3>
            <p className="mb-4">
              Before pursuing formal dispute resolution, you agree to contact DriveDrop at{' '}
              <a href="mailto:disputes@drivedrop.us.com" className="text-primary underline">
                disputes@drivedrop.us.com
              </a>{' '}
              and allow at least <strong>30 days</strong> for good-faith resolution. Most disputes can
              be resolved quickly through our support team.
            </p>
            <h3 className="text-xl font-semibold mb-3">18.2 Binding Arbitration</h3>
            <p className="mb-4">
              If informal resolution fails, any dispute, claim, or controversy arising out of or
              relating to these Terms or the Services shall be resolved by binding arbitration
              administered by the American Arbitration Association (AAA) under its Consumer Arbitration
              Rules. The arbitration shall be conducted in English, and the seat of arbitration shall
              be Charlotte, North Carolina. Each party bears its own fees unless the arbitrator awards
              otherwise.
            </p>
            <p className="mb-4">
              <strong>
                BY AGREEING TO THESE TERMS, YOU WAIVE YOUR RIGHT TO A JURY TRIAL AND TO PARTICIPATE
                IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.
              </strong>
            </p>
            <h3 className="text-xl font-semibold mb-3">18.3 Small Claims Exception</h3>
            <p>
              Notwithstanding the above, either party may bring an individual claim in small claims
              court if the claim qualifies under that court's jurisdictional requirements.
            </p>
          </section>

          {/* ─── 19. Governing Law ────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">19. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of
              <strong> North Carolina</strong>, United States, excluding its conflict-of-law provisions.
              To the extent any matter is not subject to arbitration under Section 18, the exclusive
              jurisdiction and venue shall be the state or federal courts located in
              Mecklenburg County, North Carolina.
            </p>
          </section>

          {/* ─── 20. General Provisions ───────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">20. General Provisions</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy and
                any additional policies incorporated by reference, constitute the entire agreement
                between you and DriveDrop regarding the Services.
              </li>
              <li>
                <strong>Severability:</strong> If any provision of these Terms is found unenforceable,
                the remaining provisions continue in full force.
              </li>
              <li>
                <strong>No Waiver:</strong> DriveDrop's failure to enforce any provision does not
                constitute a waiver of the right to enforce it in the future.
              </li>
              <li>
                <strong>Assignment:</strong> You may not assign your rights or obligations under these
                Terms without DriveDrop's prior written consent. DriveDrop may assign its rights in
                connection with a merger, acquisition, or sale of assets.
              </li>
            </ul>
          </section>

          {/* ─── 21. Contact ──────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">21. Contact Information</h2>
            <p className="mb-4">For questions, concerns, or notices regarding these Terms:</p>
            <ul className="list-none space-y-2">
              <li><strong>Legal inquiries:</strong>{' '}<a href="mailto:legal@drivedrop.us.com" className="text-primary underline">legal@drivedrop.us.com</a></li>
              <li><strong>Dispute resolution:</strong>{' '}<a href="mailto:disputes@drivedrop.us.com" className="text-primary underline">disputes@drivedrop.us.com</a></li>
              <li><strong>General support:</strong>{' '}<a href="mailto:support@drivedrop.us.com" className="text-primary underline">support@drivedrop.us.com</a></li>
              <li><strong>Phone:</strong>{' '}<a href="tel:+17042662317" className="text-primary underline">+1 (704) 266-2317</a></li>
              <li><strong>Mail:</strong> DriveDrop, Inc. — Legal Department, Charlotte, North Carolina, USA</li>
            </ul>
          </section>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <p className="text-sm">
              By clicking "I Accept," using our Services, or accepting via the Benji AI assistant,
              you acknowledge that you have read, understood, and agree to be bound by these Terms of
              Service and our{' '}
              <a href="/privacy" className="text-primary underline font-semibold">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}