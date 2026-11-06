import type { Metadata } from 'next'
import Link from 'next/link'
import BenjiGoLogo from '@/components/route-planner/BenjiGoLogo'

export const metadata: Metadata = {
  title: 'BenjiGo Privacy Policy',
  description: 'How BenjiGo Route Planner collects, uses and protects your data.',
}

const SUPPORT = 'privacy@drivedrop.us.com'

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

export default function BenjiGoPrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f2f6f5] text-[#132c2d]">
      <header className="border-b border-[#16306a] bg-[#0b1f44] text-white">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center px-4">
          <BenjiGoLogo />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-[#0b1f44]">BenjiGo Privacy Policy</h1>
        <p className="mt-2 text-sm text-[#5a6b6a]">Last updated: November 6, 2026</p>

        <p className="mt-6 text-[15px] leading-7 text-[#2d4244]">
          BenjiGo Route Planner (&quot;BenjiGo&quot;, the app and the website at drivedrop.us.com/route-planner) is operated by Calkons Groups LLC, doing business as DriveDrop
          (&quot;we&quot;, &quot;us&quot;). BenjiGo helps independent drivers and small fleets plan multi-stop routes, drive them with voice guidance, and keep customers updated.
          This policy explains what we collect when you use BenjiGo, why, and the choices you have.
        </p>

        <Section title="1. What we collect">
          <List items={[
            <><strong>Account information:</strong> your email address, password (stored hashed by our sign-in provider), your name and your business name if you give one.</>,
            <><strong>Planner data you enter:</strong> saved routes, stops and addresses, access notes, service times, and, if you choose to add them, the name, phone number and email address of the customer at a stop. This data is about your customers; you are responsible for having the right to enter it.</>,
            <><strong>Location:</strong> your precise location while you use navigation, and, while a trip is running, in the background (see section 2). We also receive approximate location when the device provides it.</>,
            <><strong>Delivery proof:</strong> photos, signatures, receiver names and notes you attach to a stop.</>,
            <><strong>Benji assistant messages:</strong> questions you type or speak to Benji, and the route details sent with them so he can answer. Speech is turned into text by your phone&apos;s speech recognition service; we receive the text, not the audio.</>,
            <><strong>Billing information:</strong> your plan and subscription status. Card payments are handled by Stripe; we never receive or store your full card number.</>,
            <><strong>Usage and technical data:</strong> counts of routes you optimize (for plan limits), and server logs such as request times, error messages and IP addresses.</>,
            <><strong>On your device:</strong> your sign-in session, a short-lived token for the current trip, whether you have accepted the location notice, and, when you are offline, a queue of updates to send later.</>,
          ]} />
        </Section>

        <Section title="2. Location, including in the background">
          <p>
            When you tap <strong>Start Navigation</strong>, BenjiGo asks to use your location. The Android app first shows a notice and then Android&apos;s own prompts.
            To keep your route guidance, your dispatcher&apos;s view and your customers&apos; ETA links accurate when you switch apps or the screen turns off,
            the app collects your location <strong>in the background while a trip is running</strong> and shows a &quot;Route in progress&quot; notification the whole time.
          </p>
          <List items={[
            'Tracking starts only when you start a trip and stops when you finish the trip or tap Stop.',
            'Your position is sent to our servers and shown to the people you give access to: your dispatcher, and customers who open the ETA link you send them. A customer sees your position and ETA only while that trip is active.',
            'We do not collect your location when no trip is running, and we do not use it for advertising.',
            'You can withdraw permission at any time in your phone settings (Settings, Apps, BenjiGo, Permissions, Location). Navigation then works only while the app is open.',
          ]} />
        </Section>

        <Section title="3. How we use your data">
          <List items={[
            'Plan and optimize routes, guide you turn by turn, and re-route when conditions change.',
            'Share live ETA and delivery proof with the people you choose.',
            'Answer your questions through Benji.',
            'Run your account, apply plan limits, and process subscriptions.',
            'Keep the service secure, prevent abuse, fix problems and meet legal obligations.',
            'Send service emails such as verification and account notices.',
          ]} />
          <p>We do not sell your personal information and we do not use it for advertising.</p>
        </Section>

        <Section title="4. Who we share data with">
          <p>We use service providers that process data for us, only to run BenjiGo:</p>
          <List items={[
            <><strong>Supabase</strong> for sign-in, database and file storage.</>,
            <><strong>Vercel and Railway</strong> for hosting.</>,
            <><strong>Google</strong> for maps, address search, directions and text-to-speech.</>,
            <><strong>HERE</strong> for truck-aware routing, which receives route coordinates and your vehicle size and weight.</>,
            <><strong>OpenAI</strong> for Benji, which receives your messages and the route details needed to answer. We use it in a way that does not allow your data to be used to train their models.</>,
            <><strong>Stripe</strong> for payments and subscriptions.</>,
            <><strong>Email delivery providers</strong> for service emails.</>,
          ]} />
          <p>
            We also disclose information when the law requires it, to protect people&apos;s safety, or in a merger or sale of the business.
            If you add customer details to a stop, they are used to build ETA links and are not sent to anyone else.
          </p>
        </Section>

        <Section title="5. How long we keep it">
          <List items={[
            'Account and planner data stays until you delete it or delete your account.',
            'Each trip keeps its latest reported position and stop arrivals with the trip record until you delete the route or your account. Customers can no longer see a position once the trip ends.',
            'Delivery proof stays with the stop it belongs to until you or the account is deleted.',
            'Payment and tax records may be kept for as long as the law requires.',
            'Server logs are kept for a limited time for security and troubleshooting.',
          ]} />
        </Section>

        <Section title="6. Deleting your account and data">
          <p>
            You can ask us to delete your account at any time from <strong>Billing, Account, Delete account</strong> in the app, or at{' '}
            <Link href="/route-planner/account-deletion" className="font-semibold text-[#007b72] underline">drivedrop.us.com/route-planner/account-deletion</Link>.
            If you can&apos;t sign in, email <a href={`mailto:${SUPPORT}`} className="font-semibold text-[#007b72] underline">{SUPPORT}</a> from the address on your account.
          </p>
          <p>
            We review requests within 7 business days. Deleting your account removes your profile, saved routes, address book, trip history and delivery proof, and cancels any subscription.
            We may keep payment and tax records where the law requires, and deleted data can remain in backups for a short time before it is overwritten.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            Data is encrypted in transit with HTTPS. Access to your data is limited to your account, the people you share links with, and staff who need it to run the service.
            The tracking token that lets the app report your position is limited to one trip and expires. No system is perfectly secure; if you think your account is at risk, contact us right away.
          </p>
        </Section>

        <Section title="8. Your choices and rights">
          <p>
            You can see, correct and delete much of your data inside BenjiGo. You can also ask us for a copy of your data or for corrections by emailing us.
            California residents have the rights to know, delete and not be discriminated against; we do not sell personal information.
          </p>
        </Section>

        <Section title="9. Children">
          <p>BenjiGo is for people 18 and older. We do not knowingly collect information from children.</p>
        </Section>

        <Section title="10. Changes">
          <p>If we make material changes, we will update the date above and tell you in the app or by email before they take effect.</p>
        </Section>

        <Section title="11. Contact">
          <p>
            Calkons Groups LLC d/b/a DriveDrop, Charlotte, North Carolina, USA.{' '}
            Email <a href={`mailto:${SUPPORT}`} className="font-semibold text-[#007b72] underline">{SUPPORT}</a>.
          </p>
        </Section>

        <p className="mt-10 border-t border-[#c6d4d2] pt-5 text-sm text-[#5a6b6a]">
          <Link href="/route-planner" className="font-semibold hover:underline">Back to BenjiGo</Link>
          <span className="mx-2">&middot;</span>
          <Link href="/route-planner/account-deletion" className="hover:underline">Delete account</Link>
        </p>
      </div>
    </main>
  )
}
