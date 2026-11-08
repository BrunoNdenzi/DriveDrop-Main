import type { Metadata } from 'next'
import Link from 'next/link'
import BenjiGoLogo from '@/components/route-planner/BenjiGoLogo'

export const metadata: Metadata = {
  title: 'BenjiGo Terms of Service',
  description: 'The terms for using BenjiGo Route Planner.',
}

const SUPPORT = 'support@drivedrop.us.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-[#0b1f44]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-[#2d4244]">{children}</div>
    </section>
  )
}

function List({ items }: { items: React.ReactNode[] }) {
  return <ul className="list-disc space-y-2 pl-6">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
}

export default function BenjiGoTermsPage() {
  return (
    <main className="min-h-screen bg-[#f2f6f5] text-[#132c2d]">
      <header className="border-b border-[#16306a] bg-[#0b1f44] text-white">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center px-4">
          <BenjiGoLogo />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-[#0b1f44]">BenjiGo Terms of Service</h1>
        <p className="mt-2 text-sm text-[#5a6b6a]">Last updated: November 8, 2026</p>

        <p className="mt-6 text-[15px] leading-7 text-[#2d4244]">
          These terms are an agreement between you and Calkons Groups LLC, doing business as DriveDrop (&quot;we&quot;, &quot;us&quot;), for your use of BenjiGo Route Planner,
          including the Android app and the website at drivedrop.us.com/route-planner (the &quot;Service&quot;). By creating an account or using the Service you agree to them.
          If you use BenjiGo for a company, you confirm you can accept these terms for it.
        </p>

        <Section title="1. The Service">
          <p>
            BenjiGo helps you plan and optimize multi-stop routes, guides you while you drive, lets you share live ETA links and delivery proof with customers,
            and includes Benji, an AI assistant. BenjiGo is a planning tool. We do not move goods, employ drivers, or take part in your deliveries.
          </p>
        </Section>

        <Section title="2. Your account">
          <List items={[
            'You must be at least 18 and give accurate information.',
            'Keep your password private. You are responsible for activity under your account.',
            'One person per account. Plan limits (such as drivers on the road at the same time) apply to your account as a whole.',
          ]} />
        </Section>

        <Section title="3. Drive safely and use judgment">
          <p>
            Routes, ETAs, turn instructions, traffic, vehicle-restriction checks and Benji&apos;s answers are estimates and can be wrong or out of date.
            You are always responsible for driving safely, obeying traffic laws and posted signs, and choosing a road that suits your vehicle, including its height, weight and length.
            Do not use the app in a way that takes your attention off the road. Do not rely on BenjiGo for legal, safety or compliance decisions.
          </p>
        </Section>

        <Section title="4. Location sharing">
          <p>
            When you start a trip, BenjiGo uses your location, including in the background, and shares it with the people you give access to, such as your dispatcher and customers who open an ETA link.
            You are responsible for telling those people and for sending links only to the right people. How we handle this data is described in our{' '}
            <Link href="/route-planner/privacy" className="font-semibold text-[#007b72] underline">Privacy Policy</Link>.
          </p>
        </Section>

        <Section title="5. Your data and customer data">
          <List items={[
            'You keep ownership of the routes, addresses, notes, photos and other content you put into BenjiGo. You give us permission to store and process it to run the Service for you.',
            'If you enter customer names, phone numbers or emails, you confirm you have the right to do so and will use them lawfully.',
            'Do not upload anything unlawful, harmful, or that you do not have the right to use.',
          ]} />
        </Section>

        <Section title="6. Plans, billing and cancellation">
          <List items={[
            'BenjiGo offers a Free plan and paid plans (Solo, Team and Business). Features and limits for each plan are shown in the Billing tab. New accounts may get a free trial of a paid plan.',
            'Paid plans renew each month until you cancel. Prices are shown before you subscribe. Payments are processed by Stripe.',
            'You can cancel at any time from Billing. A cancellation takes effect at the end of the current billing period, and you keep paid features until then.',
            'Except where the law requires otherwise, fees already paid are not refunded.',
            'If a payment fails, we may limit changes to your routes or move you to the Free plan until it is fixed.',
            'We may change plans and prices. We will give notice before a change affects your subscription.',
          ]} />
        </Section>

        <Section title="7. Acceptable use">
          <p>You agree not to:</p>
          <List items={[
            'misuse, probe, overload or try to break into the Service or other users&apos; accounts;',
            'use automated tools to scrape or bulk-copy the Service;',
            'resell the Service, or use it to build a competing product;',
            'send customers misleading tracking links or use location data to harass or stalk anyone;',
            'break any law while using the Service.',
          ]} />
        </Section>

        <Section title="8. Benji, the AI assistant">
          <p>
            Benji is powered by AI and can make mistakes. Check important details yourself. Your messages and the route details needed to answer are processed by our AI provider as described in the Privacy Policy.
          </p>
        </Section>

        <Section title="9. Availability and changes">
          <p>
            We work to keep BenjiGo available, but it is provided as is and may be interrupted, changed or, during beta, contain bugs.
            Maps, routing, voice and payment features depend on third-party services we do not control. We may update or remove features.
          </p>
        </Section>

        <Section title="10. Ending your account">
          <p>
            You can stop using BenjiGo at any time and delete your account at{' '}
            <Link href="/route-planner/account-deletion" className="font-semibold text-[#007b72] underline">drivedrop.us.com/route-planner/account-deletion</Link>.
            We may suspend or end accounts that break these terms or put others at risk. Deleting an account removes your data as described in the Privacy Policy.
          </p>
        </Section>

        <Section title="11. Disclaimers and limits">
          <p>
            To the extent the law allows, BenjiGo is provided without warranties of any kind, and we are not liable for indirect or consequential losses, lost profits or revenue,
            missed deliveries, fines, vehicle or cargo damage, or accidents connected with the use of the Service.
            Our total liability for any claim is limited to the amount you paid us for BenjiGo in the 12 months before the claim.
            Nothing in these terms limits liability that cannot be limited by law, and some places do not allow these limits.
          </p>
        </Section>

        <Section title="12. Intellectual property">
          <p>
            We own the Service, including the software, design and the BenjiGo name and logo. These terms do not give you any rights to them other than the right to use the Service as described here.
          </p>
        </Section>

        <Section title="13. Changes to these terms">
          <p>
            We may update these terms. If a change is material we will tell you in the app or by email before it takes effect. Continuing to use the Service after that means you accept the new terms.
          </p>
        </Section>

        <Section title="14. Governing law">
          <p>
            These terms are governed by the laws of North Carolina, United States, without regard to conflict-of-law rules. Disputes will be brought in the state or federal courts located in Mecklenburg County, North Carolina,
            except where the law of your place of residence gives you the right to use a different court.
          </p>
        </Section>

        <Section title="15. Contact">
          <p>
            Calkons Groups LLC d/b/a DriveDrop, Charlotte, North Carolina, USA. Questions about these terms:{' '}
            <a href={`mailto:${SUPPORT}`} className="font-semibold text-[#007b72] underline">{SUPPORT}</a>.
          </p>
        </Section>

        <p className="mt-10 border-t border-[#c6d4d2] pt-5 text-sm text-[#5a6b6a]">
          <Link href="/route-planner" className="font-semibold hover:underline">Back to BenjiGo</Link>
          <span className="mx-2">&middot;</span>
          <Link href="/route-planner/privacy" className="hover:underline">Privacy</Link>
        </p>
      </div>
    </main>
  )
}
