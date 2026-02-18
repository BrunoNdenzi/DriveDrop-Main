'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Truck, Shield, ArrowRight, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

type UserRole = 'client' | 'driver' | 'broker' | 'admin'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const [activeRole, setActiveRole] = useState<UserRole>('client')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Call the login API route (server-side to set cookies properly)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          role: activeRole,
          redirectTo,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      if (data.success && data.redirectTo) {
        // Use window.location for full page reload to ensure cookies are set
        window.location.href = data.redirectTo
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to sign in. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const roleConfig = {
    client: {
      icon: User,
      color: 'text-blue-600',
      iconBg: 'bg-blue-500',
      tabActive: 'data-[state=active]:bg-blue-500 data-[state=active]:text-white',
      buttonBg: 'bg-blue-500 hover:bg-blue-600',
      title: 'Client Login',
      description: 'Ship your vehicle with verified drivers',
    },
    driver: {
      icon: Truck,
      color: 'text-amber-600',
      iconBg: 'bg-amber-500',
      tabActive: 'data-[state=active]:bg-amber-500 data-[state=active]:text-white',
      buttonBg: 'bg-amber-500 hover:bg-amber-600',
      title: 'Driver Login',
      description: 'Manage your deliveries and earnings',
    },
    broker: {
      icon: User,
      color: 'text-teal-600',
      iconBg: 'bg-teal-500',
      tabActive: 'data-[state=active]:bg-teal-500 data-[state=active]:text-white',
      buttonBg: 'bg-teal-500 hover:bg-teal-600',
      title: 'Broker Login',
      description: 'Manage your carrier network and loads',
    },
    admin: {
      icon: Shield,
      color: 'text-purple-600',
      iconBg: 'bg-purple-500',
      tabActive: 'data-[state=active]:bg-purple-500 data-[state=active]:text-white',
      buttonBg: 'bg-purple-500 hover:bg-purple-600',
      title: 'Admin Login',
      description: 'Manage platform operations',
    },
  }

  const currentConfig = roleConfig[activeRole]
  const Icon = currentConfig.icon

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-16 bg-[hsl(var(--surface-field))]">
        <div className="container">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center space-y-3 mb-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-md ${currentConfig.iconBg}`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{currentConfig.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{currentConfig.description}</p>
              </div>
            </div>

            {/* Login Card */}
            <div className="bg-white border border-border rounded-md p-6 shadow-sm">
              <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as UserRole)} className="w-full">
                {/* Role Tabs */}
                <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-100 p-1 rounded-md">
                  <TabsTrigger 
                    value="client" 
                    className={`rounded text-xs ${roleConfig.client.tabActive}`}
                  >
                    <User className="w-3.5 h-3.5 mr-1.5" />
                    Client
                  </TabsTrigger>
                  <TabsTrigger 
                    value="driver"
                    className={`rounded text-xs ${roleConfig.driver.tabActive}`}
                  >
                    <Truck className="w-3.5 h-3.5 mr-1.5" />
                    Driver
                  </TabsTrigger>
                  <TabsTrigger 
                    value="broker"
                    className={`rounded text-xs ${roleConfig.broker.tabActive}`}
                  >
                    <User className="w-3.5 h-3.5 mr-1.5" />
                    Broker
                  </TabsTrigger>
                  <TabsTrigger 
                    value="admin"
                    className={`rounded text-xs ${roleConfig.admin.tabActive}`}
                  >
                    <Shield className="w-3.5 h-3.5 mr-1.5" />
                    Admin
                  </TabsTrigger>
                </TabsList>

                {/* Login Form */}
                <TabsContent value={activeRole} className="space-y-6 mt-0">
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="pl-10 h-10 rounded-md"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm font-medium">
                          Password
                        </Label>
                        <Link
                          href="/forgot-password"
                          className="text-sm text-primary hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="pl-10 pr-10 h-10 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={loading}
                      className={`w-full h-10 rounded-md font-semibold ${currentConfig.buttonBg} text-white`}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Signing in...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Sign In
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </Button>
                  </form>

                  {/* Sign Up Link */}
                  <div className="text-center pt-4 border-t border-white/10">
                    <p className="text-sm text-muted-foreground">
                      Don't have an account?{' '}
                      <Link
                        href={activeRole === 'driver' ? '/drivers/register' : activeRole === 'broker' ? '/auth/broker-signup' : '/signup'}
                        className="font-semibold text-primary hover:underline"
                      >
                        {activeRole === 'driver' ? 'Apply to become a driver' : activeRole === 'broker' ? 'Register as a broker' : 'Sign up'}
                      </Link>
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Additional Info */}
            <div className="mt-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                By signing in, you agree to our{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
