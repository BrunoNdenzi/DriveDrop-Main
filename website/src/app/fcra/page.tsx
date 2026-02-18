import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function FCRADisclosurePage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container pt-20 py-10 max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight mb-6">FCRA Background Check Disclosure</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-muted-foreground mb-6">
            <strong>Last Updated:</strong> October 27, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Fair Credit Reporting Act (FCRA) Disclosure</h2>
            <p className="mb-4">
              DriveDrop, Inc. ("Company") may obtain information about you from a consumer reporting agency 
              for employment purposes. This information may be obtained for evaluating you for initial 
              employment, promotion, reassignment, or retention as a driver.
            </p>
            <p>
              This disclosure is being provided to you pursuant to the federal Fair Credit Reporting Act (FCRA), 
              15 U.S.C. § 1681 et seq.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">What Information Will Be Obtained</h2>
            <p className="mb-4">
              The consumer report may contain information regarding your:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Criminal history:</strong> Records of arrests, convictions, and pending charges</li>
              <li><strong>Driving records:</strong> Traffic violations, accidents, suspensions, and revocations</li>
              <li><strong>Employment history:</strong> Past employers, job titles, and dates of employment</li>
              <li><strong>Education verification:</strong> Schools attended and degrees obtained</li>
              <li><strong>Credit history:</strong> Credit score, payment history, bankruptcies (if applicable to position)</li>
              <li><strong>Identity verification:</strong> Social Security Number validation, aliases</li>
              <li><strong>Sex offender registry:</strong> Checks against national and state databases</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Background Check Provider</h2>
            <p className="mb-4">
              Background checks will be conducted by:
            </p>
            <div className="p-4 bg-muted rounded-lg">
              <p><strong>[Background Check Provider Name]</strong></p>
              <p>[Provider Address]</p>
              <p>[City, State ZIP]</p>
              <p>Phone: [Phone Number]</p>
              <p>Website: [Website URL]</p>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Note: The Company will notify you of the specific provider before conducting the background check.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Your Rights Under the FCRA</h2>
            <p className="mb-4">
              Under the Fair Credit Reporting Act, you have the following rights:
            </p>

            <h3 className="text-xl font-semibold mb-3">1. Right to Disclosure</h3>
            <p className="mb-4">
              You have the right to be notified if information in your consumer report was used against you 
              in an employment decision.
            </p>

            <h3 className="text-xl font-semibold mb-3">2. Right to Obtain a Copy</h3>
            <p className="mb-4">
              You have the right to obtain a copy of your consumer report from the consumer reporting agency. 
              The agency cannot charge you for this report if it was used in an adverse action against you.
            </p>

            <h3 className="text-xl font-semibold mb-3">3. Right to Dispute</h3>
            <p className="mb-4">
              You have the right to dispute incomplete or inaccurate information with the consumer reporting 
              agency. The agency must investigate your dispute within 30 days.
            </p>

            <h3 className="text-xl font-semibold mb-3">4. Right to Add a Statement</h3>
            <p className="mb-4">
              If the agency finds the information is accurate, you have the right to add a statement to your 
              file explaining your side of the story.
            </p>

            <h3 className="text-xl font-semibold mb-3">5. Protection Against Identity Theft</h3>
            <p className="mb-4">
              Consumer reporting agencies must provide you with a free report annually upon request. 
              Visit <a href="https://www.annualcreditreport.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.annualcreditreport.com</a> or call 1-877-322-8228.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Pre-Adverse Action Notice</h2>
            <p className="mb-4">
              If we intend to take adverse action (deny or terminate your application/employment) based 
              in whole or in part on information in your consumer report, we will:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Provide you with a copy of your consumer report</li>
              <li>Provide you with a copy of "A Summary of Your Rights Under the Fair Credit Reporting Act"</li>
              <li>Wait a reasonable period (typically 5 business days) before taking final action</li>
              <li>Give you an opportunity to dispute or explain the information</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Adverse Action Notice</h2>
            <p className="mb-4">
              If we take adverse action based on information in your consumer report, we will:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Send you written notice of the adverse action</li>
              <li>Provide the name, address, and phone number of the consumer reporting agency</li>
              <li>Inform you that the agency did not make the decision and cannot explain the reasons</li>
              <li>Notify you of your right to dispute inaccurate information and obtain a free report within 60 days</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">State-Specific Rights</h2>
            <p className="mb-4">
              Some states provide additional protections:
            </p>

            <h3 className="text-xl font-semibold mb-3">California Residents</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Criminal convictions older than 7 years generally cannot be reported</li>
              <li>You have the right to request "investigative consumer report" files</li>
              <li>Additional disclosure requirements apply</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">New York Residents</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>You have the right to inspect and receive a copy of any investigative consumer report</li>
              <li>Article 23-A of the Correction Law applies to employment decisions</li>
            </ul>

            <p className="text-sm text-muted-foreground mt-4">
              Contact your state attorney general's office for state-specific FCRA rights.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">How to Dispute Information</h2>
            <p className="mb-4">
              If you believe information in your consumer report is incomplete or inaccurate:
            </p>
            <ol className="list-decimal pl-6 space-y-3">
              <li><strong>Contact the Consumer Reporting Agency:</strong> File a dispute directly with the 
              agency that provided the report (contact information provided above).</li>
              <li><strong>Provide Documentation:</strong> Submit supporting documents that prove the 
              information is incorrect (court records, payment receipts, etc.).</li>
              <li><strong>Investigation:</strong> The agency must investigate within 30 days and notify 
              you of the results.</li>
              <li><strong>Correction or Statement:</strong> If found inaccurate, the agency must correct 
              it. If they determine it's accurate, you can add a statement to your file.</li>
              <li><strong>Notify DriveDrop:</strong> Email <a href="mailto:background-disputes@drivedrop.us.com" className="text-primary underline">background-disputes@drivedrop.us.com</a> 
              with your dispute resolution.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Additional FCRA Resources</h2>
            <ul className="list-none space-y-3">
              <li>
                <strong>Federal Trade Commission (FTC):</strong><br />
                Website: <a href="https://www.consumer.ftc.gov/topics/privacy-identity-online-security" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.consumer.ftc.gov</a><br />
                Phone: 1-877-FTC-HELP (1-877-382-4357)
              </li>
              <li>
                <strong>Consumer Financial Protection Bureau (CFPB):</strong><br />
                Website: <a href="https://www.consumerfinance.gov" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.consumerfinance.gov</a><br />
                Phone: 1-855-411-CFPB (2372)
              </li>
              <li>
                <strong>Full FCRA Text:</strong><br />
                <a href="https://www.ftc.gov/legal-library/browse/statutes/fair-credit-reporting-act" target="_blank" rel="noopener noreferrer" className="text-primary underline">View the complete Fair Credit Reporting Act</a>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Consent Acknowledgment</h2>
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="mb-4">
                By checking the consent box in your driver application, you acknowledge that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You have received and read this FCRA disclosure</li>
                <li>You authorize DriveDrop to obtain consumer reports about you</li>
                <li>You understand your rights under the FCRA</li>
                <li>You consent to ongoing background checks during your tenure (if applicable)</li>
                <li>This authorization remains valid for the duration of your relationship with DriveDrop</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="mb-4">
              For questions about background checks or FCRA compliance:
            </p>
            <ul className="list-none space-y-2">
              <li><strong>Email:</strong> <a href="mailto:background@drivedrop.us.com" className="text-primary underline">background@drivedrop.us.com</a></li>
              <li><strong>Mail:</strong> DriveDrop Background Check Team, Charlotte, North Carolina, USA</li>
              <li><strong>Phone:</strong> <a href="tel:+17042662317" className="text-primary underline">+1-704-266-2317</a></li>
            </ul>
          </section>

          <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Important Notice</h3>
            <p className="text-sm">
              This disclosure does NOT constitute an offer of employment or guarantee acceptance into the 
              DriveDrop driver network. Employment/contractor status is contingent upon satisfactory 
              completion of the background check and other requirements outlined in our Terms of Service.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
