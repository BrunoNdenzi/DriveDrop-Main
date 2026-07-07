import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container pt-20 py-10 max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Privacy Policy</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-muted-foreground mb-6">
            <strong>Last Updated:</strong> July 7, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
            <p className="mb-4">
              DriveDrop ("we," "us," or "our") collects the following categories of information to provide and
              improve our vehicle shipping marketplace:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Personal Information:</strong> Name, email address, phone number, physical address, date of birth</li>
              <li><strong>Driver Information:</strong> Driver's license number, Social Security Number (for background checks and 1099 tax reporting), commercial insurance details, vehicle registration</li>
              <li><strong>Vehicle Information:</strong> Make, model, year, VIN, vehicle condition, photos taken before and after transport</li>
              <li><strong>Location &amp; GPS Data:</strong> Pickup and delivery addresses; real-time GPS coordinates of drivers during active assignments; route history for completed deliveries</li>
              <li><strong>Payment Information:</strong> Payment card details are tokenized and processed securely through Stripe. DriveDrop does <strong>not</strong> store full card numbers, CVVs, or raw banking credentials</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, search queries, session timestamps, device type, IP address, browser type</li>
              <li><strong>AI Conversation Data:</strong> Messages you send to and receive from the Benji AI assistant, including booking requests, status inquiries, and support conversations</li>
              <li><strong>Uploaded Documents &amp; Images:</strong> Driver's license scans, insurance certificates, vehicle condition photos, and any other files you upload to the platform</li>
              <li><strong>Communications:</strong> SMS messages sent or received via Twilio, in-app chat messages between clients and drivers, email correspondence with support</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">We use collected information for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Facilitate vehicle shipping quotes, bookings, and deliveries</li>
              <li>Process payments, hold deposits, capture final charges, and issue refunds via Stripe</li>
              <li>Verify driver identities and conduct criminal and driving record background checks</li>
              <li>Power the Benji AI assistant to answer questions, generate quotes, and assist with bookings</li>
              <li>Send booking confirmations, status updates, delivery notifications, and support responses via email and SMS</li>
              <li>Share real-time driver location with clients during active deliveries</li>
              <li>Detect and prevent fraud, abuse, and unauthorized account access</li>
              <li>Comply with legal obligations including IRS reporting, FCRA, and state transportation regulations</li>
              <li>Analyze platform usage to improve features and user experience</li>
              <li>Send promotional materials only with your explicit consent (you can opt out at any time)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Information Sharing</h2>
            <p className="mb-4">We share your information only as described below:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Drivers:</strong> Client contact information and shipment details shared with the assigned driver only</li>
              <li><strong>Clients:</strong> Driver name, photo, vehicle, and real-time GPS location shared with the client during active deliveries</li>
              <li><strong>Payment Processor (Stripe):</strong> Payment card data processed under Stripe's PCI-DSS Level 1 environment</li>
              <li><strong>Background Check Providers:</strong> Driver SSN and identifying information for screening purposes only</li>
              <li><strong>Email Provider (Brevo / Gmail):</strong> Email address and message content for transactional and notification emails</li>
              <li><strong>SMS Provider (Twilio):</strong> Phone number and message content for delivery notifications and booking updates. <strong>Your SMS opt-in consent and phone number are never shared with third parties for marketing purposes.</strong></li>
              <li><strong>AI Provider (OpenAI):</strong> Conversation messages sent to Benji are processed by OpenAI's API. See Section 4 for details</li>
              <li><strong>Legal Authorities:</strong> When required by law, court order, or to protect the rights, property, or safety of DriveDrop, our users, or the public</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred to the successor entity</li>
            </ul>
            <p className="mt-4 font-semibold">
              We do NOT sell your personal information to third parties for advertising or marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Benji AI Assistant — Data Processing</h2>
            <p className="mb-4">
              Our AI assistant "Benji" is powered by OpenAI's API (GPT-4o and GPT-4o-mini models). When you
              interact with Benji, the following applies:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Data Sent to OpenAI:</strong> The content of your conversation messages, including any shipment details, addresses, or vehicle information you provide, is transmitted to OpenAI's API for processing</li>
              <li><strong>Document Extraction:</strong> If you upload documents (e.g., vehicle titles, insurance cards), Benji may process the text content of those documents to assist with your request</li>
              <li><strong>Conversation Logs:</strong> AI conversation histories are stored on our servers for up to 1 year to support continuity, dispute resolution, and service improvement</li>
              <li><strong>No Training on Your Data:</strong> We use OpenAI's API in a manner that does not permit OpenAI to use your conversations to train their models (as per OpenAI's API data usage policies)</li>
              <li><strong>Limitations:</strong> Benji is an AI and may make mistakes. Do not rely solely on Benji for legal, financial, or safety-critical decisions. Final booking terms are always confirmed in writing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Payment Data &amp; Stripe</h2>
            <p className="mb-4">
              All payment processing is handled by Stripe, a PCI-DSS Level 1 certified payment processor.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>DriveDrop does <strong>not</strong> store, log, or transmit full card numbers, CVV codes, or raw bank account numbers</li>
              <li>Stripe tokenizes your payment method and provides DriveDrop with a token and last-4-digit reference only</li>
              <li>A 20% deposit is authorized at booking using Stripe's manual capture method; the remaining 80% is captured upon delivery confirmation</li>
              <li>Refunds are processed back to your original payment method through Stripe per our cancellation policy</li>
              <li>For questions about Stripe's data practices, see <a href="https://stripe.com/privacy" className="text-primary underline" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a></li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. GPS &amp; Location Data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Driver Location:</strong> When a driver accepts an assignment, their real-time GPS coordinates are collected and transmitted to our servers and shared with the corresponding client</li>
              <li><strong>Active Delivery Only:</strong> GPS tracking is active only during accepted assignments. Location data is not continuously collected when a driver is offline</li>
              <li><strong>Route History:</strong> Completed delivery routes are retained for 90 days for dispute resolution and service quality purposes</li>
              <li><strong>Client Addresses:</strong> Pickup and delivery addresses are stored as part of the shipment record for the duration of data retention (see Section 10)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Cookies, Analytics &amp; Logs</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Essential Cookies:</strong> Required for authentication, session management, and core platform functionality. Cannot be disabled</li>
              <li><strong>Analytics:</strong> We collect anonymized usage logs (page views, feature interactions, error logs) to improve the platform. These do not identify you personally</li>
              <li><strong>Server Logs:</strong> IP addresses, request timestamps, and browser/device information are logged for security monitoring and retained for 90 days</li>
              <li><strong>No Third-Party Ad Tracking:</strong> We do not use third-party advertising cookies or cross-site tracking technologies</li>
              <li>You can manage cookie preferences in your browser settings, though disabling essential cookies may impair platform functionality</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. SMS Communications &amp; Twilio</h2>
            <p className="mb-4">
              DriveDrop uses Twilio to send SMS notifications related to your bookings and deliveries.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Consent:</strong> By providing your phone number and using our Services, you consent to receive transactional SMS messages (booking confirmations, driver assignments, delivery updates, support responses)</li>
              <li><strong>Message Frequency:</strong> Message frequency varies depending on your activity. You may receive multiple messages per active shipment</li>
              <li><strong>Opt-Out:</strong> Reply <strong>STOP</strong> to any SMS message to unsubscribe from all future messages. Reply <strong>HELP</strong> for assistance</li>
              <li><strong>Message &amp; Data Rates:</strong> Standard message and data rates from your mobile carrier may apply</li>
              <li><strong>No Third-Party Marketing:</strong> Your phone number and SMS opt-in consent are <strong>never</strong> sold or shared with third parties for marketing or promotional purposes</li>
              <li><strong>Program Support:</strong> For SMS support, contact <a href="mailto:support@drivedrop.us.com" className="text-primary underline">support@drivedrop.us.com</a> or call <a href="tel:+17042662317" className="text-primary underline">+1 (704) 266-2317</a></li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Data Security</h2>
            <p className="mb-4">
              We implement industry-standard technical and organizational measures to protect your information:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>TLS/SSL encryption for all data in transit</li>
              <li>AES-256 encryption for sensitive data at rest (SSN, background check data)</li>
              <li>Row-level security policies on our database to ensure users can only access their own data</li>
              <li>Access controls and role-based permissions for internal staff</li>
              <li>Secure cloud infrastructure hosted on Supabase and Railway</li>
            </ul>
            <p className="mt-4">
              Despite these measures, no internet transmission or electronic storage is 100% secure. If you
              believe your account has been compromised, contact us immediately at{' '}
              <a href="mailto:support@drivedrop.us.com" className="text-primary underline">support@drivedrop.us.com</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Data Retention</h2>
            <p className="mb-4">We retain your information for the following periods:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Data:</strong> Retained until you request deletion or 7 years of inactivity, whichever comes first</li>
              <li><strong>Transaction Records:</strong> 7 years (required by IRS regulations)</li>
              <li><strong>Driver Background Check Data:</strong> 7 years (required by FCRA)</li>
              <li><strong>Communication Logs (email, SMS, in-app chat):</strong> 2 years</li>
              <li><strong>AI Conversation History:</strong> 1 year from last message</li>
              <li><strong>Server &amp; Access Logs:</strong> 90 days</li>
              <li><strong>GPS Route History:</strong> 90 days post-delivery</li>
            </ul>
            <p className="mt-4">
              After retention periods expire, data is securely deleted or anonymized. Certain data may be
              retained longer if required by an ongoing legal proceeding or regulatory obligation.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Your Rights</h2>
            <p className="mb-4">
              Depending on your location, you may have the following rights regarding your personal data:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements — <a href="/account-deletion" className="text-primary underline font-semibold">Submit a deletion request</a></li>
              <li><strong>Opt-Out of Marketing:</strong> Unsubscribe from promotional emails at any time via the unsubscribe link in any email, or by contacting us</li>
              <li><strong>SMS Opt-Out:</strong> Reply STOP to any SMS message</li>
              <li><strong>Data Portability:</strong> Request your data in a machine-readable format (JSON/CSV)</li>
              <li><strong>Object to Processing:</strong> Object to certain processing activities such as profiling</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@drivedrop.us.com" className="text-primary underline">privacy@drivedrop.us.com</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Children's Privacy</h2>
            <p>
              DriveDrop Services are intended for individuals 18 years of age or older. We do not knowingly
              collect personal information from children under 18. If you believe we have inadvertently
              collected information from a minor, please contact us immediately at{' '}
              <a href="mailto:privacy@drivedrop.us.com" className="text-primary underline">privacy@drivedrop.us.com</a>{' '}
              and we will delete it promptly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">13. International Users</h2>
            <p>
              Our Services are offered primarily within the United States. If you access our platform from
              outside the US, your information will be transferred to and processed in the United States,
              where data protection laws may differ from those in your jurisdiction. By using our Services,
              you consent to this transfer and processing.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">14. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we will
              notify you via email and/or a prominent notice within the platform at least 30 days before
              the changes take effect. The "Last Updated" date at the top of this page reflects the most
              recent revision. Continued use of our Services after the effective date constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">15. Contact Us</h2>
            <p className="mb-4">For privacy-related questions, requests, or concerns, please contact us:</p>
            <ul className="list-none space-y-2">
              <li><strong>Email:</strong>{' '}<a href="mailto:privacy@drivedrop.us.com" className="text-primary underline">privacy@drivedrop.us.com</a></li>
              <li><strong>Phone:</strong>{' '}<a href="tel:+17042662317" className="text-primary underline">+1 (704) 266-2317</a></li>
              <li><strong>Mail:</strong> DriveDrop, Inc. — Privacy Team, Charlotte, North Carolina, USA</li>
            </ul>
          </section>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <p className="text-sm font-semibold mb-2">California Residents (CCPA Notice)</p>
            <p className="text-sm">
              Under the California Consumer Privacy Act (CCPA), California residents have the right to know
              what personal information we collect, the right to delete it, the right to opt out of its sale
              (we do not sell personal information), and the right to non-discrimination for exercising these
              rights. To submit a verifiable consumer request, contact us at{' '}
              <a href="mailto:privacy@drivedrop.us.com" className="text-primary underline">privacy@drivedrop.us.com</a>.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
