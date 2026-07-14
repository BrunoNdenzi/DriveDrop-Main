'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Mail, Lock, Phone, ArrowRight, AlertCircle, CheckCircle, Truck, Eye, EyeOff } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { trackSignupCompleted } from '@/lib/analytics'

function SignUpPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const role = searchParams.get('role') || 'client' // Get role from URL param
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [smsConsent, setSmsConsent] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [otpStep, setOtpStep] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const getSignupErrorMessage = (message?: string) => {
    if (!message) return 'Failed to create account. Please try again.'
    const normalized = message.toLowerCase()
    if (normalized.includes('error sending email') || normalized.includes('confirmation email')) {
      return 'Failed to send the email, please contact support'
    }
    return message
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          role,
          smsConsent,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Failed to create account. Please try again.')
      }

      const responseData = await response.json().catch(() => ({}))
      const returnedUserId = (responseData as { userId?: string }).userId
      if (returnedUserId) setUserId(returnedUserId)

      // Send welcome email (don't block on this)
      try {
        await fetch('/api/emails/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            role,
          }),
        })
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError)
      }

      trackSignupCompleted(role)

      // Try to trigger phone OTP if phone + smsConsent provided
      if (formData.phone && smsConsent && returnedUserId) {
        try {
          const otpRes = await fetch('/api/auth/send-phone-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: formData.phone }),
          })
          if (otpRes.ok) {
            setOtpStep(true)
            return
          }
        } catch {
          // OTP service unavailable — skip to success
        }
      }

      setSuccess(true)
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(getSignupErrorMessage(err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setOtpLoading(true)
    setOtpError(null)
    try {
      const res = await fetch('/api/auth/verify-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone, code: otpCode, userId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || 'Invalid code. Please try again.')
      }
      setSuccess(true)
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  if (otpStep) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-20 pb-16 bg-[hsl(var(--surface-field))] flex items-center justify-center">
          <div className="container">
            <div className="max-w-md mx-auto">
              <div className="bg-white border border-border rounded-md p-6 shadow-sm">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-blue-500 mb-4">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-xl font-bold">Verify Your Phone</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    We sent a 6-digit code to <strong>{formData.phone}</strong>
                  </p>
                </div>

                {otpError && (
                  <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{otpError}</p>
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otpCode">Verification Code</Label>
                    <Input
                      id="otpCode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      className="h-10 rounded-md text-center text-lg tracking-widest"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={otpLoading || otpCode.length !== 6}
                    className="w-full h-10 bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {otpLoading ? 'Verifying...' : 'Verify Phone Number'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSuccess(true)}
                    className="w-full text-sm text-muted-foreground hover:text-foreground text-center py-1"
                  >
                    Skip for now
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  if (success) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-20 pb-16 bg-background flex items-center justify-center">
          <div className="container">
            <div className="max-w-md mx-auto text-center space-y-6 bg-white border border-border rounded-md p-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-emerald-50 border border-emerald-200">
                <CheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Check Your Email!</h1>
                <p className="text-muted-foreground">
                  We've sent a verification link to <strong>{formData.email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Please verify your email before logging in. Check your spam folder if you don't see it.
                </p>
              </div>
              <div className="pt-4">
                <Button onClick={() => router.push('/login')} className="w-full">
                  Go to Login
                </Button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-16 bg-[hsl(var(--surface-field))]">
        <div className="container">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center space-y-3 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-blue-500">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Create Your Account</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {role === 'client' && 'Join DriveDrop and start shipping your vehicles today'}
                  {role === 'broker' && 'Join DriveDrop as a broker and connect your network'}
                  {!role || (role !== 'client' && role !== 'broker') && 'Join DriveDrop today'}
                </p>
              </div>
            </div>

            {/* Signup Card */}
            <div className="bg-white border border-border rounded-md p-6 shadow-sm">
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      type="text"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="h-10 rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      type="text"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="h-10 rounded-md"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="pl-10 h-10 rounded-md"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="pl-10 h-10 rounded-md"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      className="pl-10 pr-10 h-10 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters long
                  </p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      minLength={8}
                      className="pl-10 pr-10 h-10 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* SMS Consent */}
                <div className="flex items-start gap-3 p-3 bg-muted/40 border border-border rounded-md">
                  <input
                    id="smsConsent"
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 accent-blue-500"
                  />
                  <label htmlFor="smsConsent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                    By providing my phone number, I consent to receive transactional SMS messages from DriveDrop about my
                    shipments and account updates. Message frequency varies. Msg &amp; data rates may apply.
                    Reply <strong>STOP</strong> to opt out, <strong>HELP</strong> for help.
                    See our <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a> and{' '}
                    <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>.
                  </label>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-md font-semibold bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Create Account
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>

              {/* Login Link */}
              <div className="text-center pt-6 mt-6 border-t border-white/10">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/login" className="font-semibold text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>

            {/* Driver & Broker Application Links */}
            <div className="mt-6 space-y-3">
              <div className="text-center bg-white border border-amber-200 rounded-md p-5 bg-amber-50/50">
                <p className="text-sm text-muted-foreground mb-3">
                  Want to become a driver and earn money?
                </p>
                <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                  <Link href="/drivers/register">
                    <Truck className="w-4 h-4 mr-2" />
                    Apply as a Driver
                  </Link>
                </Button>
              </div>
              
              <div className="text-center bg-white border border-teal-200 rounded-md p-5 bg-teal-50/50">
                <p className="text-sm text-muted-foreground mb-3">
                  Are you a licensed auto transport broker?
                </p>
                <Button asChild size="sm" className="bg-teal-500 hover:bg-teal-600 text-white">
                  <Link href="/auth/broker-signup">
                    <User className="w-4 h-4 mr-2" />
                    Register as a Broker
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignUpPageContent />
    </Suspense>
  )
}
