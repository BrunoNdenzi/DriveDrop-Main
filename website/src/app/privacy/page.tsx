import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-muted-foreground mb-6">
            <strong>Last Updated:</strong> October 27, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
            <p className="mb-4">
              DriveDrop ("we," "us," or "our") collects information to provide and improve our vehicle shipping services. 
              The types of information we collect include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Personal Information:</strong> Name, email address, phone number, physical address</li>
              <li><strong>Driver Information:</strong> Driver's license number, SSN (for background checks), insurance information</li>
              <li><strong>Vehicle Information:</strong> Make, model, year, VIN, condition photos</li>
              <li><strong>Location Data:</strong> Pickup and delivery addresses, GPS tracking during shipment</li>
              <li><strong>Payment Information:</strong> Credit card details (processed securely through Stripe)</li>
              <li><strong>Usage Data:</strong> How you interact with our app and website</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">We use collected information for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Facilitate vehicle shipping and delivery services</li>
              <li>Process payments and refunds</li>
              <li>Verify driver identities and conduct background checks</li>
              <li>Communicate about shipments, updates, and service changes</li>
              <li>Improve our services and user experience</li>
              <li>Comply with legal obligations and prevent fraud</li>
              <li>Send promotional materials (with your consent)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Information Sharing</h2>
            <p className="mb-4">We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Drivers:</strong> Contact information and shipment details for assigned deliveries</li>
              <li><strong>Service Providers:</strong> Payment processors (Stripe), background check services, email providers</li>
              <li><strong>Legal Authorities:</strong> When required by law or to protect rights and safety</li>
              <li><strong>Business Transfers:</strong> In case of merger, acquisition, or asset sale</li>
            </ul>
            <p className="mt-4">
              We do NOT sell your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>SSL/TLS encryption for data transmission</li>
              <li>AES-256 encryption for sensitive data at rest (SSN, payment info)</li>
              <li>Regular security audits and penetration testing</li>
              <li>Access controls and authentication requirements</li>
              <li>Secure cloud infrastructure (Supabase, Railway)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your data (subject to legal requirements)</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Data Portability:</strong> Receive your data in a machine-readable format</li>
              <li><strong>Object:</strong> Object to certain data processing activities</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at <a href="mailto:privacy@drivedrop.us.com" className="text-primary underline">privacy@drivedrop.us.com</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Data Retention</h2>
            <p>
              We retain your information for as long as necessary to provide services and comply with legal obligations:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>Account Data:</strong> Until account deletion or 7 years of inactivity</li>
              <li><strong>Transaction Records:</strong> 7 years (IRS requirement)</li>
              <li><strong>Driver Background Checks:</strong> 7 years (FCRA requirement)</li>
              <li><strong>Communication Logs:</strong> 2 years</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar technologies to enhance user experience:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Essential Cookies:</strong> Required for core functionality</li>
              <li><strong>Analytics Cookies:</strong> Track usage patterns and improve services</li>
              <li><strong>Marketing Cookies:</strong> Deliver personalized ads (with consent)</li>
            </ul>
            <p className="mt-4">
              You can manage cookie preferences in your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Children's Privacy</h2>
            <p>
              DriveDrop services are not intended for individuals under 18 years of age. 
              We do not knowingly collect information from children. If you believe we have 
              inadvertently collected such information, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. International Users</h2>
            <p>
              Our services are primarily offered in the United States. If you access our services 
              from outside the US, your information may be transferred to and processed in the US, 
              where data protection laws may differ from your country.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of material changes 
              via email or app notification. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Contact Us</h2>
            <p className="mb-4">For privacy-related questions or concerns, contact us at:</p>
            <ul className="list-none space-y-2">
              <li><strong>Email:</strong> <a href="mailto:privacy@drivedrop.us.com" className="text-primary underline">privacy@drivedrop.us.com</a></li>
              <li><strong>Mail:</strong> DriveDrop Privacy Team, [Your Address]</li>
              <li><strong>Phone:</strong> 1-704-312-0690</li>
            </ul>
          </section>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>California Residents:</strong> Under the California Consumer Privacy Act (CCPA), 
              you have additional rights. See our <a href="/ccpa" className="text-primary underline">CCPA Notice</a> for details.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
