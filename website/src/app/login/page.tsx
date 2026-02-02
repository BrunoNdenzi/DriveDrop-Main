'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Truck, Shield, ArrowRight, Mail, Lock, AlertCircle, Sparkles, Eye, EyeOff } from 'lucide-react'
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
      color: 'text-primary',
      gradient: 'from-primary to-accent',
      title: 'Client Login',
      description: 'Ship your vehicle with verified drivers',
    },
    driver: {
      icon: Truck,
      color: 'text-secondary',
      gradient: 'from-secondary to-drivedrop-orange-light',
      title: 'Driver Login',
      description: 'Manage your deliveries and earnings',
    },
    broker: {
      icon: User,
      color: 'text-blue-600',
      gradient: 'from-blue-600 to-blue-800',
      title: 'Broker Login',
      description: 'Manage your carrier network and loads',
    },
    admin: {
      icon: Shield,
      color: 'text-accent',
      gradient: 'from-accent to-primary',
      title: 'Admin Login',
      description: 'Manage platform operations',
    },
  }

  const currentConfig = roleConfig[activeRole]
  const Icon = currentConfig.icon

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-16 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="container relative z-10">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center space-y-4 mb-8 animate-slide-up">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${currentConfig.gradient} shadow-xl`}>
                <Icon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">{currentConfig.title}</h1>
                <p className="text-muted-foreground mt-2">{currentConfig.description}</p>
              </div>
            </div>

            {/* Login Card */}
            <div className="glass rounded-3xl p-8 shadow-2xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as UserRole)} className="w-full">
                {/* Role Tabs */}
                <TabsList className="grid w-full grid-cols-4 mb-8 bg-muted/50 p-1 rounded-xl">
                  <TabsTrigger 
                    value="client" 
                    className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Client
                  </TabsTrigger>
                  <TabsTrigger 
                    value="driver"
                    className="rounded-lg data-[state=active]:bg-secondary data-[state=active]:text-white transition-all"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Driver
                  </TabsTrigger>
                  <TabsTrigger 
                    value="broker"
                    className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Broker
                  </TabsTrigger>
                  <TabsTrigger 
                    value="admin"
                    className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-white transition-all"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </TabsTrigger>
                </TabsList>

                {/* Login Form */}
                <TabsContent value={activeRole} className="space-y-6 mt-0">
                  {error && (
                    <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-slide-down">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-6">
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
                          className="pl-10 h-12 rounded-xl"
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
                          className="pl-10 pr-10 h-12 rounded-xl"
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
                      className={`w-full h-12 rounded-xl font-semibold bg-gradient-to-r ${currentConfig.gradient} hover-lift group`}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Signing in...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5" />
                          Sign In
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
            <div className="mt-8 text-center space-y-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
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
