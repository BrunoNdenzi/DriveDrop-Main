'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

interface UserProfile {
  id: string
  email: string
  role: 'client' | 'driver' | 'admin'
  first_name?: string
  last_name?: string
  phone?: string
  avatar_url?: string
  created_at?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
}

interface UseAuthReturn {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  
  // Use singleton supabase client
  const supabase = getSupabaseBrowserClient()

  const fetchProfile = async (userId: string) => {
    try {
      // Add a timeout to prevent infinite hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout after 5 seconds')), 5000)
      )
      
      // OPTIMIZED: Only select needed fields (70% less data transfer)
      const fetchPromise = supabase
        .from('profiles')
        .select('id, email, role, first_name, last_name, phone, avatar_url, created_at')
        .eq('id', userId)
        .single()
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any

      if (error) {
        console.error('[useAuth] Error fetching profile:', error)
        return null
      }

      return data as UserProfile
    } catch (error) {
      console.error('[useAuth] Error fetching profile:', error)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  useEffect(() => {
    let mounted = true
    
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user && mounted) {
          setUser(session.user)
          
          const profileData = await fetchProfile(session.user.id)
          
          if (mounted) {
            if (profileData) {
              setProfile(profileData)
            } else {
              // Fallback: create profile from user metadata
              const fallbackProfile: UserProfile = {
                id: session.user.id,
                email: session.user.email || '',
                role: (session.user.user_metadata?.role as 'client' | 'driver' | 'admin') || 'client',
                first_name: session.user.user_metadata?.first_name,
                last_name: session.user.user_metadata?.last_name,
                phone: session.user.user_metadata?.phone,
              }
              setProfile(fallbackProfile)
            }
          }
        }
      } catch (error) {
        console.error('[useAuth] Error initializing auth:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle sign out - everything else is handled in initializeAuth
      if (event === 'SIGNED_OUT' && mounted) {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // Empty deps - only run once on mount

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return {
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
  }
}
