'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from '@/components/icons/streamline-lucide'

type UserRole = 'client' | 'driver' | 'broker' | 'admin'

const roleConfig: Record<UserRole, { label: string; signupHref: string; signupLabel: string }> = {
  client: { label: 'Shipper', signupHref: '/signup', signupLabel: 'Create a shipper account' },
  driver: { label: 'Driver', signupHref: '/drivers/register', signupLabel: 'Apply to drive' },
  broker: { label: 'Broker', signupHref: '/auth/broker-signup', signupLabel: 'Register as a broker' },
  admin: { label: 'Admin', signupHref: '/signup', signupLabel: 'Create an account' },
}

function AccessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-4 first:pr-3 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-white/20 [&:not(:first-child)]:px-3 sm:py-5 sm:[&:not(:first-child)]:px-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9fc1be] sm:text-xs">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white sm:text-base">{value}</p>
    </div>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const isVerified = searchParams.get('verified') === 'true'
  const [activeRole, setActiveRole] = useState<UserRole>('client')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: activeRole, redirectTo }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Login failed')
      if (data.success && data.redirectTo) window.location.href = data.redirectTo
    } catch (loginError) {
      console.error('Login error:', loginError)
      setError(loginError instanceof Error ? loginError.message : 'Failed to sign in. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const currentRole = roleConfig[activeRole]

  return (
    <main className="min-h-screen bg-[#f2f6f5] text-[#132c2d]">
      <header className="border-b border-[#ccd9d7] bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="DriveDrop home">
            <Image src="/logo-primary.png" alt="DriveDrop" width={132} height={36} className="h-8 w-auto" priority />
          </Link>
          <Link href="/" className="text-sm font-semibold text-[#526c6b] transition-colors hover:text-[#007b72]">Back to site</Link>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1440px] lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <div className="relative flex min-h-[330px] flex-col justify-between overflow-hidden bg-[#123638] px-6 py-8 text-white sm:px-10 sm:py-12 lg:min-h-full lg:px-16 lg:py-16">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="relative max-w-xl">
            <div className="mb-8 inline-flex items-center gap-2 border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#c7f3ed]">
              <ShieldCheck className="h-4 w-4" />
              Verified vehicle logistics
            </div>
            <h1 className="max-w-lg text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">Every move, accounted for.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#c8d9d8] sm:text-lg">One operational network for vehicle owners, drivers, and freight partners.</p>
          </div>

          <div className="relative mt-10 grid grid-cols-3 border-y border-white/20">
            <AccessMetric label="Tracked" value="Real time" />
            <AccessMetric label="Coverage" value="Nationwide" />
            <AccessMetric label="Support" value="Human" />
          </div>
        </div>

        <div className="flex items-center bg-white px-5 py-10 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008c82]">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#132c2d]">Sign in to DriveDrop</h2>
            <p className="mt-2 text-sm leading-6 text-[#667b79]">Use the workspace assigned to your account.</p>

            {isVerified && (
              <div className="mt-5 flex items-start gap-3 border border-[#a7d8c5] bg-[#edf9f3] p-3 text-[#17603f]" role="status">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">Email verified. You can now sign in.</p>
              </div>
            )}

            <div className="mt-7 grid grid-cols-4 border border-[#cbd8d6] bg-[#f2f6f5] p-1" role="group" aria-label="Account type">
              {(Object.keys(roleConfig) as UserRole[]).map(role => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={activeRole === role}
                  onClick={() => setActiveRole(role)}
                  className={`h-10 px-1 text-xs font-semibold transition-colors sm:text-sm ${activeRole === role ? 'bg-white text-[#007b72] shadow-sm' : 'text-[#647977] hover:text-[#132c2d]'}`}
                >
                  {roleConfig[role].label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-5 flex items-start gap-3 border border-[#e5b8b4] bg-[#fff4f3] p-3 text-[#9f2f27]" role="alert">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form className="mt-7 space-y-5" onSubmit={handleLogin}>
              <label className="block" htmlFor="email">
                <span className="mb-2 block text-sm font-semibold text-[#263f40]">Email address</span>
                <span className="relative block">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-[#708482]" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    required
                    className="h-11 w-full border border-[#b9c9c7] bg-white pl-11 pr-3 text-sm outline-none transition-colors placeholder:text-[#8ea09e] focus:border-[#008c82] focus:ring-2 focus:ring-[#008c82]/15"
                  />
                </span>
              </label>

              <label className="block" htmlFor="password">
                <span className="mb-2 flex items-center justify-between text-sm font-semibold text-[#263f40]">
                  Password
                  <Link href="/forgot-password" className="font-medium text-[#007b72] hover:underline">Forgot password?</Link>
                </span>
                <span className="relative block">
                  <LockKeyhole className="absolute left-3 top-3 h-5 w-5 text-[#708482]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    required
                    className="h-11 w-full border border-[#b9c9c7] bg-white pl-11 pr-11 text-sm outline-none transition-colors placeholder:text-[#8ea09e] focus:border-[#008c82] focus:ring-2 focus:ring-[#008c82]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(current => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1.5 grid h-8 w-8 place-items-center text-[#708482] transition-colors hover:text-[#132c2d]"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 bg-[#008c82] px-4 text-sm font-bold text-white transition-colors hover:bg-[#00756d] focus:outline-none focus:ring-2 focus:ring-[#008c82] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Signing in</>
                ) : (
                  <>Continue as {currentRole.label.toLowerCase()}<ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-[#dce5e3] pt-5">
              <Link href={currentRole.signupHref} className="text-sm font-semibold text-[#007b72] hover:underline">{currentRole.signupLabel}</Link>
              <p className="mt-4 text-xs leading-5 text-[#718482]">
                By signing in, you agree to our <Link href="/terms" className="hover:underline">Terms</Link> and <Link href="/privacy" className="hover:underline">Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#f2f6f5]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#b8cdca] border-t-[#008c82]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}